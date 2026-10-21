"""A small Xero Accounting API client.

Deliberately thin: one call per method, explicit paging, explicit token refresh. Rate limiting is surfaced
to the caller as ``RateLimited`` with Xero's Retry-After so Convex can reschedule the step instead of
sleeping inside a serverless function.
"""

from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from ..settings import Settings
from .models import Connection, Tokens

SCOPES = (
    "openid profile email offline_access "
    "accounting.transactions.read accounting.reports.read accounting.settings.read accounting.contacts.read"
)
REFRESH_MARGIN_SECONDS = 120


class XeroError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"Xero {status}: {message}")
        self.status = status


class RateLimited(XeroError):
    def __init__(self, retry_after: int):
        super().__init__(429, f"rate limited, retry after {retry_after}s")
        self.retry_after = retry_after


class ReauthRequired(XeroError):
    """The refresh token was rejected. The owner has to reconnect."""


class _Transient(Exception):
    pass


@dataclass
class XeroClient:
    settings: Settings
    tokens: Tokens | None = None
    tenant_id: str | None = None
    http: httpx.Client | None = None
    rotated: bool = False

    def __post_init__(self) -> None:
        if self.http is None:
            self.http = httpx.Client(timeout=30)

    # ---------- identity ----------
    def authorize_url(self, redirect_uri: str, state: str, code_challenge: str) -> str:
        query = urlencode(
            {
                "response_type": "code",
                "client_id": self.settings.xero_client_id,
                "redirect_uri": redirect_uri,
                "scope": SCOPES,
                "state": state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            }
        )
        return f"https://login.xero.com/identity/connect/authorize?{query}"

    def _basic(self) -> str:
        raw = f"{self.settings.xero_client_id}:{self.settings.xero_client_secret}".encode()
        return "Basic " + base64.b64encode(raw).decode()

    def _token_request(self, form: dict) -> Tokens:
        response = self.http.post(
            f"{self.settings.xero_identity_base}/connect/token",
            data=form,
            headers={"Authorization": self._basic(), "Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code in (400, 401):
            raise ReauthRequired(response.status_code, response.text[:200])
        if response.status_code >= 300:
            raise XeroError(response.status_code, response.text[:200])
        body = response.json()
        return Tokens(
            access_token=body["access_token"],
            refresh_token=body["refresh_token"],
            expires_at=time.time() + int(body.get("expires_in", 1800)),
        )

    def exchange_code(self, code: str, redirect_uri: str, code_verifier: str) -> Tokens:
        self.tokens = self._token_request(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
            }
        )
        return self.tokens

    def refresh(self) -> Tokens:
        assert self.tokens is not None
        self.tokens = self._token_request({"grant_type": "refresh_token", "refresh_token": self.tokens.refresh_token})
        self.rotated = True
        return self.tokens

    def ensure_fresh(self) -> None:
        if self.tokens and self.tokens.expires_at - time.time() < REFRESH_MARGIN_SECONDS:
            self.refresh()

    def connections(self) -> list[Connection]:
        data = self._get_json(f"{self.settings.xero_api_base}/connections", tenant=False)
        return [
            Connection(tenant_id=c["tenantId"], tenant_name=c.get("tenantName") or "", tenant_type=c.get("tenantType") or "")
            for c in data
            if c.get("tenantType", "ORGANISATION") == "ORGANISATION"
        ]

    # ---------- accounting ----------
    def accounts(self) -> list[dict]:
        return self._get_json(self._api("Accounts")).get("Accounts", [])

    def journals(self, offset: int) -> list[dict]:
        """Up to 100 journals with JournalNumber greater than ``offset``, in order."""
        return self._get_json(self._api("Journals"), params={"offset": offset}).get("Journals", [])

    def open_invoices(self, page: int) -> list[dict]:
        params = {"where": 'Status=="AUTHORISED"', "page": page, "summaryOnly": "true"}
        return self._get_json(self._api("Invoices"), params=params).get("Invoices", [])

    def profit_and_loss(self, from_date: str, to_date: str, periods: int) -> dict:
        params = {"fromDate": from_date, "toDate": to_date, "periods": periods, "timeframe": "MONTH"}
        return self._get_json(self._api("Reports/ProfitAndLoss"), params=params)["Reports"][0]

    def balance_sheet(self, date: str, periods: int) -> dict:
        params = {"date": date, "periods": periods, "timeframe": "MONTH"}
        return self._get_json(self._api("Reports/BalanceSheet"), params=params)["Reports"][0]

    # ---------- transport ----------
    def _api(self, resource: str) -> str:
        return f"{self.settings.xero_api_base}/api.xro/2.0/{resource}"

    def _headers(self, tenant: bool) -> dict:
        assert self.tokens is not None, "no tokens"
        headers = {"Authorization": f"Bearer {self.tokens.access_token}", "Accept": "application/json"}
        if tenant:
            assert self.tenant_id, "no tenant"
            headers["xero-tenant-id"] = self.tenant_id
        return headers

    @retry(
        retry=retry_if_exception_type(_Transient),
        stop=stop_after_attempt(3),
        wait=wait_exponential_jitter(multiplier=0.5, max=4),
        reraise=True,
    )
    def _get_json(self, url: str, params: dict | None = None, tenant: bool = True):
        self.ensure_fresh()
        response = self.http.get(url, params=params, headers=self._headers(tenant))
        if response.status_code == 401 and self.tokens:
            self.refresh()
            response = self.http.get(url, params=params, headers=self._headers(tenant))
        if response.status_code == 429:
            raise RateLimited(int(response.headers.get("Retry-After", "60")))
        if response.status_code >= 500:
            raise _Transient(response.status_code)
        if response.status_code >= 300:
            raise XeroError(response.status_code, response.text[:200])
        return response.json()
