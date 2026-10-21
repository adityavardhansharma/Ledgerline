import time

import httpx
import pytest
import respx

from ledgerline_engine.xero.client import RateLimited, ReauthRequired, XeroClient
from ledgerline_engine.xero.models import Tokens
from ledgerline_engine.xero.normalise import (
    UnbalancedJournal,
    normalise_journal,
    normalise_open_item,
    parse_xero_date,
)

API = "https://api.xero.com/api.xro/2.0"


def journal(number, lines):
    return {
        "JournalID": f"j-{number}",
        "JournalNumber": number,
        "JournalDate": "/Date(1788134400000+0000)/",
        "SourceType": "ACCREC",
        "JournalLines": lines,
    }


def test_parse_dates():
    assert parse_xero_date("/Date(1788134400000+0000)/") == "2026-08-31"
    assert parse_xero_date("2026-09-30T00:00:00") == "2026-09-30"
    assert parse_xero_date(None) == ""


def test_normalise_balanced_journal():
    raw = journal(
        7,
        [
            {"JournalLineID": "l1", "AccountID": "sales", "NetAmount": -48600.0, "Description": "INV-2291"},
            {"JournalLineID": "l2", "AccountID": "debtors", "NetAmount": 58320.0},
            {"JournalLineID": "l3", "AccountID": "vat", "NetAmount": -9720.0},
        ],
    )
    j = normalise_journal(raw)
    assert j.journal_number == 7
    assert [line.net_cents for line in j.lines] == [-4860000, 5832000, -972000]
    assert sum(line.net_cents for line in j.lines) == 0


def test_unbalanced_journal_is_refused():
    with pytest.raises(UnbalancedJournal):
        normalise_journal(journal(8, [{"AccountID": "a", "NetAmount": 10}, {"AccountID": "b", "NetAmount": -9}]))


def test_open_items_skip_paid():
    assert normalise_open_item({"Type": "ACCREC", "AmountDue": 0}) is None
    item = normalise_open_item({"Type": "ACCPAY", "AmountDue": "120.50", "Contact": {"Name": "Timber Co"}, "DueDate": "2026-10-01T00:00:00"})
    assert item.kind == "payable" and item.amount_due_cents == 12050 and item.due_date == "2026-10-01"


@respx.mock
def test_journals_paging_sends_tenant_and_offset(settings, tokens):
    route = respx.get(f"{API}/Journals").mock(return_value=httpx.Response(200, json={"Journals": [journal(101, [])]}))
    client = XeroClient(settings, tokens=tokens, tenant_id="tenant-1")
    result = client.journals(100)
    assert result[0]["JournalNumber"] == 101
    request = route.calls.last.request
    assert request.url.params["offset"] == "100"
    assert request.headers["xero-tenant-id"] == "tenant-1"
    assert request.headers["Authorization"] == "Bearer access"


@respx.mock
def test_rate_limit_surfaces_retry_after(settings, tokens):
    respx.get(f"{API}/Journals").mock(return_value=httpx.Response(429, headers={"Retry-After": "17"}))
    client = XeroClient(settings, tokens=tokens, tenant_id="t")
    with pytest.raises(RateLimited) as err:
        client.journals(0)
    assert err.value.retry_after == 17


@respx.mock
def test_expired_token_is_refreshed_before_the_call(settings):
    respx.post("https://identity.xero.com/connect/token").mock(
        return_value=httpx.Response(200, json={"access_token": "new", "refresh_token": "r2", "expires_in": 1800})
    )
    route = respx.get(f"{API}/Accounts").mock(return_value=httpx.Response(200, json={"Accounts": []}))
    stale = Tokens(access_token="old", refresh_token="r1", expires_at=time.time() + 30)
    client = XeroClient(settings, tokens=stale, tenant_id="t")
    client.accounts()
    assert client.rotated and client.tokens.refresh_token == "r2"
    assert route.calls.last.request.headers["Authorization"] == "Bearer new"


@respx.mock
def test_rejected_refresh_requires_reauth(settings):
    respx.post("https://identity.xero.com/connect/token").mock(return_value=httpx.Response(400, json={"error": "invalid_grant"}))
    client = XeroClient(settings, tokens=Tokens(access_token="a", refresh_token="r", expires_at=0), tenant_id="t")
    with pytest.raises(ReauthRequired):
        client.accounts()


@respx.mock
def test_server_errors_are_retried(settings, tokens):
    route = respx.get(f"{API}/Accounts").mock(
        side_effect=[httpx.Response(503), httpx.Response(200, json={"Accounts": [{"AccountID": "x", "Name": "Sales", "Type": "REVENUE"}]})]
    )
    client = XeroClient(settings, tokens=tokens, tenant_id="t")
    assert client.accounts()[0]["AccountID"] == "x"
    assert route.call_count == 2


def test_authorize_url_uses_pkce(settings):
    url = XeroClient(settings).authorize_url("https://example.convex.site/xero/callback", "state123", "challenge")
    assert "code_challenge=challenge" in url and "code_challenge_method=S256" in url
    assert "offline_access" in url and "state=state123" in url
