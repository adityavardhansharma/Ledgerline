"""A small Xero Accounting API client.

Deliberately thin: one call per method, explicit paging, explicit token refresh. Rate limiting is surfaced
to the caller as ``RateLimited`` with Xero's Retry-After so Convex can reschedule the step instead of
sleeping inside a serverless function.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from ..settings import Settings
from .models import Connection, Tokens

# Granular scopes (Xero assigns these to every app created since March 2026), one per endpoint used.
BASE_SCOPES = (
    "openid",
    "profile",
    "email",
    "offline_access",
    "accounting.settings.read",  # Accounts, Organisation
    "accounting.reports.trialbalance.read",  # monthly movements
    "accounting.reports.profitandloss.read",  # the check against Xero
    "accounting.reports.balancesheet.read",
    "accounting.invoices.read",  # invoices, bills and credit notes: drill-down and ageing
    "accounting.payments.read",  # payments: drill-down and daily cash
    "accounting.banktransactions.read",  # bank transactions: drill-down and daily cash
    "accounting.manualjournals.read",  # manual journals: drill-down
)
JOURNALS_SCOPE = "accounting.journals.read"


def requested_scopes(journals: bool) -> str:
    return " ".join((*BASE_SCOPES, JOURNALS_SCOPE) if journals else BASE_SCOPES)


def granted_scopes(body: dict) -> str:
    """Xero returns the granted scopes with the tokens; the access token's ``scope`` claim says the same."""
    if body.get("scope"):
        return str(body["scope"])
    try:
        payload = body["access_token"].split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        scope = claims.get("scope", "")
        return " ".join(scope) if isinstance(scope, list) else str(scope)
    except (KeyError, IndexError, ValueError):
        return ""


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
                "scope": requested_scopes(self.settings.xero_journals),
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
            scope=granted_scopes(body),
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

    def organisation(self) -> dict:
        return (self._get_json(self._api("Organisation")).get("Organisations") or [{}])[0]

    def trial_balance(self, date: str) -> dict:
        """Movements for the month up to ``date``, with year-to-date columns."""
        return self._get_json(self._api("Reports/TrialBalance"), params={"date": date})["Reports"][0]

    def documents(
        self, resource: str, key: str, date_from: str, date_to: str, max_pages: int = 10, extra: str = ""
    ) -> list[dict]:
        """Every document of one kind dated within a range, with line items (Xero includes them when paging)."""
        y1, m1, d1 = (int(x) for x in date_from.split("-"))
        y2, m2, d2 = (int(x) for x in date_to.split("-"))
        where = f"Date >= DateTime({y1}, {m1:02d}, {d1:02d}) && Date <= DateTime({y2}, {m2:02d}, {d2:02d}){extra}"
        out: list[dict] = []
        for page in range(1, max_pages + 1):
            batch = self._get_json(self._api(resource), params={"where": where, "page": page}).get(key, [])
            out.extend(batch)
            if len(batch) < 100:
                break
        return out

    def optional_documents(self, resource: str, key: str, date_from: str, date_to: str, max_pages: int = 10) -> list[dict]:
        """As ``documents``, but a source the app may not read (403) is skipped rather than failing."""
        try:
            return self.documents(resource, key, date_from, date_to, max_pages)
        except XeroError as exc:
            if exc.status in (401, 403) and not isinstance(exc, ReauthRequired):
                return []
            raise

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
