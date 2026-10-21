"""Xero without journal access: trial balances, documents, scopes and the endpoints that use them."""

import base64
import importlib.util
import json
import sys
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from ledgerline_engine.api import app
from ledgerline_engine.settings import Settings, get_settings
from ledgerline_engine.statements.build import build_all, period_add
from ledgerline_engine.xero.activity import (
    Roles,
    account_activity,
    bank_transaction_postings,
    credit_note_postings,
    daily_cash,
    invoice_postings,
    manual_journal_postings,
    payment_postings,
)
from ledgerline_engine.xero.balances import RETAINED_ID, monthly_movements, parse_trial_balance
from ledgerline_engine.xero.client import JOURNALS_SCOPE, XeroClient, granted_scopes, requested_scopes
from ledgerline_engine.xero.models import Tokens

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sample_company", ROOT / "scripts" / "sample_company.py")
sample = importlib.util.module_from_spec(spec)
sys.modules["sample_company"] = sample
spec.loader.exec_module(sample)

PNL_TYPES = {"REVENUE", "DIRECTCOSTS", "OVERHEADS", "WAGESEXPENSE", "DEPRECIATN", "EXPENSE"}
ACCOUNTS = [
    {"xero_account_id": f"id-{c}", "code": c, "name": n, "type": t, "account_class": "", "system_account": s}
    for c, n, t, s in sample.ACCOUNTS
]
API = "https://api.xero.com/api.xro/2.0"


# ---------- building Xero-shaped trial balances from the sample company's journals ----------


def _journal_movements():
    moves: dict[tuple[str, str], int] = {}
    for j in sample.generate():
        for code, cents, _ in j.lines:
            key = (f"id-{code}", j.date.strftime("%Y-%m"))
            moves[key] = moves.get(key, 0) + cents
    return moves


def _cell(cents: int, debit: bool) -> dict:
    return {"Value": f"{max(cents, 0) / 100:.2f}" if debit else f"{max(-cents, 0) / 100:.2f}"}


def _trial_balance(moves, period: str, rollover_in_month: bool) -> dict:
    """What Xero returns as at ``period``'s end: month and year-to-date columns, last year's profit rolled
    into retained earnings (Xero does this in reports; journals never do)."""
    year = period[:4]
    rows = []
    for account in ACCOUNTS:
        aid = account["xero_account_id"]
        is_pnl = account["type"] in PNL_TYPES
        month = moves.get((aid, period), 0)
        if is_pnl:
            ytd = sum(v for (a, p), v in moves.items() if a == aid and p[:4] == year and p <= period)
        else:
            ytd = sum(v for (a, p), v in moves.items() if a == aid and p <= period)
        if account["system_account"] == "RETAINEDEARNINGS":
            prior_profit = sum(v for (a, p), v in moves.items() if p[:4] < year and _is_pnl(a))
            ytd += prior_profit
            if rollover_in_month and period.endswith("-01"):
                month += sum(v for (a, p), v in moves.items() if p[:4] == str(int(year) - 1) and _is_pnl(a))
        rows.append(
            {
                "RowType": "Row",
                "Cells": [
                    {"Value": f"{account['name']} ({account['code']})", "Attributes": [{"Value": aid, "Id": "account"}]},
                    _cell(month, True),
                    _cell(month, False),
                    _cell(ytd, True),
                    _cell(ytd, False),
                ],
            }
        )
    return {
        "ReportID": "TrialBalance",
        "Rows": [
            {"RowType": "Header", "Cells": [{"Value": t} for t in ("Account", "Debit", "Credit", "YTD Debit", "YTD Credit")]},
            {"RowType": "Section", "Title": "Accounts", "Rows": rows},
            {"RowType": "Section", "Rows": [{"RowType": "SummaryRow", "Cells": [{"Value": "Total"}]}]},
        ],
    }


def _is_pnl(account_id: str) -> bool:
    return next(a["type"] for a in ACCOUNTS if a["xero_account_id"] == account_id) in PNL_TYPES


@pytest.mark.parametrize("rollover_in_month", [False, True])
def test_trial_balances_rebuild_the_same_statements_as_journals(rollover_in_month):
    moves = _journal_movements()
    opening = "2024-09"
    periods = [period_add(opening, k) for k in range(25)]  # opening + Oct 2024 … Sep 2026, across a year end
    reports = {p: _trial_balance(moves, p, rollover_in_month) for p in periods}
    result = monthly_movements(reports, opening, "id-960")

    from_tb = [
        {"xero_account_id": line["xero_account_id"], "period": block["period"], "net_cents": line["net_cents"]}
        for block in result["periods"]
        for line in block["lines"]
    ]
    from_journals = [{"xero_account_id": a, "period": p, "net_cents": v} for (a, p), v in moves.items() if v]
    assert result["syntheticAccounts"] == []
    # Only the January after a year end needs the retained earnings correction.
    assert set(result["retainedAdjustments"]) <= {"2025-01", "2026-01"}

    ours = build_all(ACCOUNTS, from_tb, 1, "2026-09")
    truth = build_all(ACCOUNTS, from_journals, 1, "2026-09")
    for key in ("pnl", "cashflow", "measures", "series", "bridge"):
        assert ours[key] == truth[key], key
    # Retained earnings before the opening month are one figure in Xero's trial balance, so how it splits
    # between the account and "from prior years" can differ (dividends posted long ago); equity can't.
    split = {"Retained earnings", "Retained earnings from prior years"}
    assert [r for r in ours["balance"]["rows"] if r.get("label") not in split] == [
        r for r in truth["balance"]["rows"] if r.get("label") not in split
    ]
    total = lambda rows: [sum(v[i] for r in rows if r.get("label") in split for v in [r["values"]]) for i in range(2)]  # noqa: E731
    assert total(ours["balance"]["rows"]) == total(truth["balance"]["rows"])


def test_rows_without_an_account_become_accounts_and_the_residual_goes_to_retained_earnings():
    report = {
        "Rows": [
            {
                "RowType": "Header",
                "Cells": [
                    {"Value": "Account"},
                    {"Value": "Debit"},
                    {"Value": "Credit"},
                    {"Value": "YTD Debit"},
                    {"Value": "YTD Credit"},
                ],
            },
            {
                "RowType": "Section",
                "Title": "Revenue",
                "Rows": [
                    {
                        "RowType": "Row",
                        "Cells": [
                            {"Value": "Sales (200)", "Attributes": [{"Value": "sales", "Id": "account"}]},
                            {"Value": ""},
                            {"Value": "100.00"},
                            {"Value": ""},
                            {"Value": "300.00"},
                        ],
                    }
                ],
            },
            {
                "RowType": "Section",
                "Title": "Assets",
                "Rows": [
                    {
                        "RowType": "Row",
                        "Cells": [{"Value": "Rounding"}, {"Value": "60.00"}, {"Value": ""}, {"Value": "60.00"}, {"Value": ""}],
                    }
                ],
            },
        ]
    }
    rows = parse_trial_balance(report)
    assert [(r.account_id, r.section, r.month_net) for r in rows] == [
        ("sales", "Revenue", Decimal("-100.00")),
        (None, "Assets", Decimal("60.00")),
    ]
    result = monthly_movements({"2026-09": report}, None, None)
    lines = {line["xero_account_id"]: line["net_cents"] for line in result["periods"][0]["lines"]}
    assert lines == {"sales": -10_000, "xero:row:rounding": 6_000, RETAINED_ID: 4_000}
    assert sum(lines.values()) == 0
    assert {a["xero_account_id"] for a in result["syntheticAccounts"]} == {"xero:row:rounding", RETAINED_ID}


# ---------- scopes ----------


def test_journals_are_requested_only_when_the_app_has_them():
    assert JOURNALS_SCOPE not in requested_scopes(False).split()
    assert JOURNALS_SCOPE in requested_scopes(True).split()
    assert "accounting.reports.trialbalance.read" in requested_scopes(False).split()
    url = XeroClient(Settings(xero_client_id="c")).authorize_url("https://x/cb", "s", "c" * 43)
    assert "accounting.journals.read" not in url


def test_granted_scopes_come_from_the_token_response_or_the_access_token():
    assert granted_scopes({"scope": "openid accounting.journals.read"}) == "openid accounting.journals.read"
    claims = base64.urlsafe_b64encode(json.dumps({"scope": ["openid", "accounting.invoices.read"]}).encode()).decode().rstrip("=")
    assert granted_scopes({"access_token": f"h.{claims}.s"}) == "openid accounting.invoices.read"
    assert granted_scopes({"access_token": "opaque"}) == ""


# ---------- documents to postings ----------

ROLES = Roles.from_accounts(ACCOUNTS)


def _balanced(postings):
    return sum(p.net for p in postings) == 0


def test_invoices_bills_and_credit_notes_post_double_entry():
    sale = {
        "Type": "ACCREC",
        "Status": "AUTHORISED",
        "InvoiceNumber": "INV-1",
        "DateString": "2026-09-04T00:00:00",
        "LineAmountTypes": "Exclusive",
        "Contact": {"Name": "Seaview Hotel"},
        "LineItems": [{"AccountCode": "200", "LineAmount": 1000, "TaxAmount": 135}],
        "TotalTax": 135,
        "Total": 1135,
    }
    bill = {
        "Type": "ACCPAY",
        "Status": "PAID",
        "InvoiceNumber": "B-7",
        "DateString": "2026-09-05T00:00:00",
        "LineAmountTypes": "Inclusive",
        "LineItems": [{"AccountCode": "310", "LineAmount": 1230, "TaxAmount": 230}],
        "TotalTax": 230,
        "Total": 1230,
    }
    draft = {**sale, "Status": "DRAFT"}
    postings = invoice_postings([sale, bill, draft], ROLES)
    by = {(p.reference, p.account_id): p.net for p in postings}
    assert (
        by[("INV-1", "id-200")] == Decimal("-1000")
        and by[("INV-1", "id-610")] == Decimal("1135")
        and by[("INV-1", "id-820")] == Decimal("-135")
    )
    assert (
        by[("B-7", "id-310")] == Decimal("1000")
        and by[("B-7", "id-800")] == Decimal("-1230")
        and by[("B-7", "id-820")] == Decimal("230")
    )
    assert _balanced(postings)
    note = {
        "Type": "ACCRECCREDIT",
        "Status": "AUTHORISED",
        "CreditNoteNumber": "CN-1",
        "DateString": "2026-09-09",
        "LineItems": [{"AccountCode": "200", "LineAmount": 100}],
        "TotalTax": 0,
        "Total": 100,
    }
    notes = credit_note_postings([note], ROLES)
    assert {p.account_id: p.net for p in notes} == {"id-200": Decimal("100"), "id-610": Decimal("-100")}


def test_payments_bank_transactions_and_manual_journals():
    bank = {"AccountID": "id-090"}
    payment = {
        "PaymentType": "ACCRECPAYMENT",
        "Status": "AUTHORISED",
        "Amount": 1135,
        "DateString": "2026-09-20",
        "Account": bank,
        "Invoice": {"InvoiceNumber": "INV-1", "Contact": {"Name": "Seaview Hotel"}},
    }
    spend = {
        "Type": "SPEND",
        "Status": "AUTHORISED",
        "BankAccount": bank,
        "DateString": "2026-09-03",
        "Reference": "Card",
        "LineAmountTypes": "NoTax",
        "LineItems": [{"AccountCode": "485", "LineAmount": 290}],
        "TotalTax": 0,
        "Total": 290,
    }
    transfer = {"Type": "SPEND-TRANSFER", "Status": "AUTHORISED", "BankAccount": bank, "DateString": "2026-09-03", "Total": 50}
    journal = {
        "Status": "POSTED",
        "DateString": "2026-09-30",
        "Narration": "Depreciation",
        "JournalLines": [{"AccountCode": "416", "LineAmount": 310}, {"AccountCode": "711", "LineAmount": -310}],
    }
    postings = (
        payment_postings([payment], ROLES)
        + bank_transaction_postings([spend, transfer], ROLES)
        + manual_journal_postings([journal], ROLES)
    )
    assert {(p.source, p.account_id): p.net for p in postings} == {
        ("Payment", "id-090"): Decimal("1135"),
        ("Payment", "id-610"): Decimal("-1135"),
        ("Bank transaction", "id-485"): Decimal("290"),
        ("Bank transaction", "id-090"): Decimal("-290"),
        ("Bank transfer", "id-090"): Decimal("-50"),
        ("Manual journal", "id-416"): Decimal("310"),
        ("Manual journal", "id-711"): Decimal("-310"),
    }
    assert daily_cash(postings, {"id-090"}) == [
        {"date": "2026-09-03", "net_cents": -34_000},
        {"date": "2026-09-20", "net_cents": 113_500},
    ]


def test_activity_adds_up_to_the_figure_and_names_what_documents_cannot_explain():
    journal = {
        "Status": "POSTED",
        "DateString": "2026-09-30",
        "Narration": "Depreciation",
        "JournalLines": [{"AccountCode": "416", "LineAmount": 310}, {"AccountCode": "711", "LineAmount": -310}],
    }
    result = account_activity("id-416", manual_journal_postings([journal], ROLES), movement_cents=40_000)
    assert result["lines"] == [
        {
            "date": "2026-09-30",
            "source": "Manual journal",
            "reference": "",
            "contact": "",
            "description": "Depreciation",
            "net_cents": 31_000,
        }
    ]
    assert (result["explained_cents"], result["unexplained_cents"]) == (31_000, 9_000)


# ---------- endpoints ----------


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    app.dependency_overrides[get_settings] = lambda: Settings(allow_unsigned=True, xero_client_id="c", xero_client_secret="x")
    yield TestClient(app)
    app.dependency_overrides.clear()
    get_settings.cache_clear()


TENANT = {"tokens": {"access_token": "a", "refresh_token": "r", "expires_at": 4_000_000_000}, "tenant_id": "t"}


@respx.mock
def test_trial_balance_endpoint_reads_each_month_end_and_today_for_the_current_month(api):
    moves = _journal_movements()
    seen = []

    def respond(request):
        date = request.url.params["date"]
        seen.append(date)
        return httpx.Response(200, json={"Reports": [_trial_balance(moves, date[:7], False)]})

    respx.get(f"{API}/Reports/TrialBalance").mock(side_effect=respond)
    response = api.post(
        "/xero/trial-balances",
        json={
            **TENANT,
            "periods": ["2026-08", "2026-09"],
            "opening_period": "2026-08",
            "retained_earnings_id": "id-960",
            "today": "2026-09-14",
        },
    )
    assert response.status_code == 200, response.text
    assert seen == ["2026-08-31", "2026-09-14"]
    september = next(b for b in response.json()["periods"] if b["period"] == "2026-09")
    assert sum(line["net_cents"] for line in september["lines"]) == 0


@respx.mock
def test_activity_endpoint_skips_sources_the_app_cannot_read(api):
    sale = {
        "Type": "ACCREC",
        "Status": "AUTHORISED",
        "InvoiceNumber": "INV-1",
        "DateString": "2026-09-04",
        "LineItems": [{"AccountCode": "200", "LineAmount": 1000}],
        "TotalTax": 0,
        "Total": 1000,
    }
    invoices = respx.get(f"{API}/Invoices").mock(return_value=httpx.Response(200, json={"Invoices": [sale]}))
    respx.get(f"{API}/CreditNotes").mock(return_value=httpx.Response(403, json={"Title": "Forbidden"}))
    respx.get(f"{API}/BankTransactions").mock(return_value=httpx.Response(200, json={"BankTransactions": []}))
    respx.get(f"{API}/ManualJournals").mock(return_value=httpx.Response(200, json={"ManualJournals": []}))
    response = api.post(
        "/xero/account-activity",
        json={**TENANT, "accounts": ACCOUNTS, "account_id": "id-200", "period": "2026-09", "movement_cents": -100_000},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert [line["net_cents"] for line in body["lines"]] == [-100_000]
    assert body["unexplained_cents"] == 0
    assert "DateTime(2026, 09, 01)" in invoices.calls[0].request.url.params["where"]


@respx.mock
def test_the_organisation_just_authorised_comes_first():
    respx.get("https://api.xero.com/connections").mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "tenantId": "trial",
                    "tenantName": "LedgerLine",
                    "tenantType": "ORGANISATION",
                    "updatedDateUtc": "2026-10-21T13:00:00",
                },
                {
                    "tenantId": "practice",
                    "tenantName": "Practice",
                    "tenantType": "PRACTICE",
                    "updatedDateUtc": "2026-10-21T15:00:00",
                },
                {
                    "tenantId": "demo",
                    "tenantName": "Demo Company (Global)",
                    "tenantType": "ORGANISATION",
                    "updatedDateUtc": "2026-10-21T14:30:00",
                },
            ],
        )
    )
    client = XeroClient(Settings(), tokens=Tokens(access_token="a", refresh_token="r", expires_at=4_000_000_000))
    assert [c.tenant_id for c in client.connections()] == ["demo", "trial"]
