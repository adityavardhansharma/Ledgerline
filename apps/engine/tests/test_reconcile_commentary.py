import json

import httpx
import pytest
import respx

from ledgerline_engine.commentary.draft import CommentaryInvalid, Fact, draft, validate
from ledgerline_engine.reconcile.ageing import age
from ledgerline_engine.reconcile.compare import compare
from ledgerline_engine.statements.build import Ledger, period_range

from .fixtures import ACCOUNTS, balances_from, month_journals, opening_journals


def ledger():
    journals = {"2025-12": opening_journals()}
    for period in period_range("2026-01", "2026-09"):
        journals[period] = month_journals(period, 20_000_000)
    return Ledger.from_payload(ACCOUNTS, balances_from(journals))


def report(rows):
    return {"Rows": [{"RowType": "Header", "Cells": []}, {"RowType": "Section", "Title": "x", "Rows": rows}]}


def row(account_id, name, *values):
    return {
        "RowType": "Row",
        "Cells": [{"Value": name, "Attributes": [{"Id": "account", "Value": account_id}]}] + [{"Value": v} for v in values],
    }


def test_matching_reports():
    pnl = report([row("sales", "Sales", "200000.00", "200000.00"), row("rent", "Rent", "6200.00", "6200.00")])
    bs = report([row("loan", "Bank loan", "125400.00")])
    result = compare(ledger(), pnl, bs, "2026-09", months=2)
    assert result["status"] == "match", result["differences"]
    assert result["compared"] == 5


def test_difference_is_reported_per_account_and_month():
    pnl = report([row("sales", "Sales", "200100.00")])
    result = compare(ledger(), pnl, None, "2026-09", months=1)
    assert result["status"] == "mismatch"
    diff = result["differences"][0]
    assert diff["accountId"] == "sales" and diff["diffCents"] == -10_000 and diff["period"] == "2026-09"


def test_current_year_earnings_is_compared_with_profit_to_date():
    # Xero's computed row (not an account): profit for the financial year so far, newest month first.
    cye = row("xero-cye", "Current Year Earnings", "224100.00", "199200.00")
    assert compare(ledger(), None, report([cye]), "2026-09", months=2)["status"] == "match"
    wrong = row("xero-cye", "Current Year Earnings", "224100.01", "199200.00")
    result = compare(ledger(), None, report([wrong]), "2026-09", months=2)
    assert [d["period"] for d in result["differences"]] == ["2026-09"]


def test_ageing_buckets():
    items = [
        {"kind": "receivable", "contact": "A", "due_date": "2026-10-10", "amount_due_cents": 100},
        {"kind": "receivable", "contact": "B", "due_date": "2026-09-15", "amount_due_cents": 200},
        {"kind": "receivable", "contact": "B", "due_date": "2026-05-01", "amount_due_cents": 300},
        {"kind": "payable", "contact": "C", "due_date": "2026-09-29", "amount_due_cents": 50},
    ]
    out = age(items, "2026-09-30")
    assert [b["value"] for b in out["receivable"]] == [100, 200, 0, 0, 300]
    assert out["receivableTop"][0] == {"contact": "B", "value": 500}
    assert out["payable"][1]["value"] == 50


FACTS = [
    Fact(id="rev", label="Revenue", value="€228,900", source="4000 Sales, Sep 2026"),
    Fact(id="cash", label="Cash", value="€412,300", source="Bank, 30 Sep"),
]


def test_validator_renders_citations():
    payload = {
        "paragraphs": [[{"type": "text", "text": "Revenue reached ", "fact": ""}, {"type": "fact", "text": "", "fact": "rev"}]]
    }
    out = validate(payload, FACTS)
    assert out == [["Revenue reached ", {"text": "€228,900", "source": "Revenue · 4000 Sales, Sep 2026"}]]


@pytest.mark.parametrize("text", ["Revenue grew 15%", "about €5k more", "in 2026"])
def test_validator_rejects_numbers_outside_citations(text):
    with pytest.raises(CommentaryInvalid):
        validate({"paragraphs": [[{"type": "text", "text": text, "fact": ""}]]}, FACTS)


def test_validator_rejects_unknown_facts():
    with pytest.raises(CommentaryInvalid):
        validate({"paragraphs": [[{"type": "fact", "text": "", "fact": "ebitda"}]]}, FACTS)


@respx.mock
def test_draft_retries_once_after_a_bad_answer(settings):
    settings.openrouter_api_key = "key"
    bad = {"paragraphs": [[{"type": "text", "text": "Revenue was 228,900", "fact": ""}]]}
    good = {
        "paragraphs": [[{"type": "text", "text": "Cash closed at ", "fact": ""}, {"type": "fact", "text": "", "fact": "cash"}]]
    }
    route = respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        side_effect=[httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(p)}}]}) for p in (bad, good)]
    )
    out = draft(FACTS, settings)
    assert out[0][1]["text"] == "€412,300"
    assert route.call_count == 2
