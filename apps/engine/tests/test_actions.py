"""AI actions: facts the engine computes, the checks on what the model returns, and the pure-arithmetic parts."""

import importlib.util
import json
import sys
from pathlib import Path

import httpx
import pytest
import respx

from ledgerline_engine.actions.common import ActionInvalid, stated_numbers
from ledgerline_engine.actions.explain import (
    AnomalyExplainRequest,
    AnomalyRequest,
    CashDipRequest,
    DigestRequest,
    DownsideRequest,
    ExplainFigureRequest,
    MismatchRequest,
    ReminderRequest,
    cash_dip,
    detect_anomalies,
    digest,
    downside,
    downside_changes,
    explain_anomalies,
    explain_figure,
    mismatch,
    reminder,
)
from ledgerline_engine.actions.parse import (
    ImportMapRequest,
    NameScenarioRequest,
    ParseScenarioRequest,
    SearchParseRequest,
    import_map,
    name_scenario,
    parse_scenario,
    search_parse,
)

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sample_company", ROOT / "scripts" / "sample_company.py")
sample = importlib.util.module_from_spec(spec)
sys.modules["sample_company"] = sample
spec.loader.exec_module(sample)

OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"


def reply(payload):
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(payload)}}]})


def seg(text, fact=""):
    return {"text": text, "fact": fact}


@pytest.fixture
def live(settings):
    settings.openrouter_api_key = "key"
    return settings


@pytest.fixture(scope="module")
def ledger():
    accounts = [
        {"xero_account_id": f"csv:{c}", "code": c, "name": n, "type": t, "account_class": "", "system_account": s}
        for c, n, t, s in sample.ACCOUNTS
    ]
    totals: dict[tuple[str, str], int] = {}
    for j in sample.generate():
        for code, value, _ in j.lines:
            key = (f"csv:{code}", j.date.strftime("%Y-%m"))
            totals[key] = totals.get(key, 0) + value
    return {
        "accounts": accounts,
        "balances": [{"xero_account_id": a, "period": p, "net_cents": v} for (a, p), v in totals.items()],
    }


def test_stated_numbers_read_suffixes():
    assert {42.0, 42_000.0, 1.2, 1_200_000.0, 50_000.0} <= stated_numbers("hire at 42k, €1.2m loan, 50,000 grant")


@respx.mock
def test_explain_figure_cites_the_largest_lines(live):
    route = respx.post(OPENROUTER).mock(
        return_value=reply({"paragraphs": [[seg("Rent rose "), seg("", "vsPrevious"), seg(" because of "), seg("", "line1")]]})
    )
    body = ExplainFigureRequest(
        account="Rent",
        period="2026-09",
        value_cents=620_000,
        previous_cents=430_000,
        lines=[
            {"date": "2026-09-01", "description": "Unit 4 rent", "cents": 620_000},
            {"date": "2026-09-02", "description": "Small fee", "cents": 100},
        ],
    )
    out = explain_figure(body, live)
    assert out["paragraphs"][0][1]["text"] == "44.2%"
    assert out["paragraphs"][0][3]["text"] == "€6,200"
    prompt = json.loads(route.calls[0].request.content)["messages"][1]["content"]
    assert "Unit 4 rent, 1 Sep 2026 (adds)" in prompt


@respx.mock
def test_cash_dip_returns_fixes_tagged_by_area(live):
    respx.post(OPENROUTER).mock(
        return_value=reply(
            {
                "paragraphs": [[seg("Cash runs out in "), seg("", "when")]],
                "fixes": [{"area": "financing", "text": [seg("Draw a loan before "), seg("", "when")]}],
            }
        )
    )
    months = [
        {
            "period": f"2027-0{i}",
            "cash": 1_000_000 - i * 400_000,
            "operating": -400_000,
            "investing": 0,
            "financing": 0,
            "hires": -100_000,
        }
        for i in range(1, 5)
    ]
    out = cash_dip(CashDipRequest(months=months, opening_cash=1_000_000, cash_out_period="2027-03"), live)
    assert out["fixes"][0]["area"] == "financing"
    assert out["paragraphs"][0][1]["text"] == "March 2027"


@respx.mock
def test_cash_dip_rejects_an_unknown_area(live):
    respx.post(OPENROUTER).mock(
        return_value=reply({"paragraphs": [[seg("Low in "), seg("", "when")]], "fixes": [{"area": "magic", "text": [seg("x")]}]})
    )
    with pytest.raises(ActionInvalid):
        cash_dip(CashDipRequest(months=[{"period": "2027-01", "cash": -1}], opening_cash=10, cash_out_period="2027-01"), live)


@respx.mock
def test_mismatch_maps_reasons_back_to_lines(live):
    respx.post(OPENROUTER).mock(
        return_value=reply(
            {
                "summary": [seg("One line differs.")],
                "items": [{"line": 1, "reason": [seg("Posted after the sync: "), seg("", "d1Gap")], "fix": "sync"}],
            }
        )
    )
    out = mismatch(
        MismatchRequest(
            differences=[
                {"accountId": "rent", "name": "Rent", "period": "2026-09", "oursCents": 100, "xeroCents": 300, "diffCents": -200}
            ]
        ),
        live,
    )
    assert out["items"][0] == {
        "accountId": "rent",
        "name": "Rent",
        "period": "2026-09",
        "reason": [
            "Posted after the sync: ",
            {"text": "€2", "source": "Difference on Rent, September 2026 · Reconciliation", "fact": "d1Gap"},
        ],
        "fix": "sync",
    }


def test_digest_with_no_change_skips_the_model(live):
    side = {"as_of": "2026-09", "cash": 100, "rows": [{"accountId": "a", "label": "Sales", "value": 5}]}
    assert digest(DigestRequest(before=side, after=side), live) == {"items": [], "unchanged": True, "facts": []}


@respx.mock
def test_digest_reports_the_largest_changes(live):
    respx.post(OPENROUTER).mock(return_value=reply({"items": [[seg("Cash rose "), seg("", "cash")]]}))
    before = {"as_of": "2026-08", "cash": 100_000, "rows": [{"accountId": "a", "label": "Sales", "value": 5}]}
    after = {"as_of": "2026-09", "cash": 150_000, "rows": [{"accountId": "a", "label": "Sales", "value": 900}]}
    out = digest(DigestRequest(before=before, after=after), live)
    assert out["items"][0][1]["text"] == "€500"
    assert {f["id"] for f in out["facts"]} >= {"newMonth", "cash", "account1"}


def test_anomalies_flag_a_spike_and_ignore_normal_months():
    accounts = [
        {"xero_account_id": "bank", "code": "090", "name": "Bank", "type": "BANK"},
        {"xero_account_id": "sales", "code": "200", "name": "Sales", "type": "REVENUE"},
        {"xero_account_id": "mkt", "code": "400", "name": "Marketing", "type": "OVERHEADS"},
        {"xero_account_id": "rent", "code": "469", "name": "Rent", "type": "OVERHEADS"},
    ]
    balances = [{"xero_account_id": "bank", "period": "2025-08", "net_cents": 1}]
    for k in range(13):
        period = f"{2025 + (8 + k) // 12}-{(8 + k) % 12 + 1:02d}"
        balances += [
            {"xero_account_id": "sales", "period": period, "net_cents": -10_000_000},
            {
                "xero_account_id": "mkt",
                "period": period,
                "net_cents": 600_000 + (k % 3) * 10_000 if period != "2026-09" else 2_400_000,
            },
            {"xero_account_id": "rent", "period": period, "net_cents": 620_000},
        ]
    flags = detect_anomalies(AnomalyRequest(accounts=accounts, balances=balances, as_of="2026-09"))
    assert [f["name"] for f in flags] == ["Marketing"]
    assert flags[0]["nowCents"] == 2_400_000 and flags[0]["typicalCents"] == 610_000


@respx.mock
def test_anomaly_reasons_need_one_per_flag(live):
    flag = {
        "accountId": "mkt",
        "name": "Marketing",
        "kind": "overhead",
        "period": "2026-09",
        "nowCents": 2_400_000,
        "typicalCents": 600_000,
    }
    respx.post(OPENROUTER).mock(
        side_effect=[
            reply({"reasons": []}),
            reply({"reasons": [{"flag": 1, "text": [seg("Four times "), seg("", "f1Typical")]}]}),
        ]
    )
    out = explain_anomalies(AnomalyExplainRequest(flags=[flag]), live)
    assert out[0]["accountId"] == "mkt"


@respx.mock
def test_reminder_cites_the_invoices(live):
    respx.post(OPENROUTER).mock(
        return_value=reply(
            {"subject": [seg("Overdue invoices: "), seg("", "total")], "body": [[seg("Dear Seaview, "), seg("", "inv1")]]}
        )
    )
    out = reminder(
        ReminderRequest(
            company="Kestrel",
            contact="Seaview",
            as_of="2026-10-01",
            items=[{"number": "INV-1", "due_date": "2026-09-01", "amount_due_cents": 500_000}],
        ),
        live,
    )
    assert out["body"][0][1]["text"] == "INV-1, €5,000, 30 days overdue"


def test_downside_moves_drivers_to_the_worst_recent_month(ledger):
    changes = downside_changes(
        DownsideRequest(
            **ledger, as_of="2026-09", drivers={"growth": 0.02, "grossMargin": 0.5, "debtorDays": 30, "overheadGrowth": 0.04}
        )
    )
    by_key = {c["key"]: c for c in changes}
    assert by_key["grossMargin"]["to"] < 0.5 and by_key["debtorDays"]["to"] > 30
    assert by_key["overheadGrowth"]["to"] == 0.07


@respx.mock
def test_downside_names_without_numbers(live, ledger):
    respx.post(OPENROUTER).mock(
        side_effect=[
            reply({"name": "Downside 2027", "reasons": []}),
            reply({"name": "Tougher year", "reasons": [{"change": 1, "text": [seg("Margin falls "), seg("", "c1")]}]}),
        ]
    )
    out = downside(
        DownsideRequest(
            **ledger, as_of="2026-09", drivers={"growth": 0.02, "grossMargin": 0.5, "debtorDays": 30, "overheadGrowth": 0.04}
        ),
        live,
    )
    assert out["name"] == "Tougher year"
    assert out["changes"][0]["reason"][1]["fact"] == "c1"


@respx.mock
def test_parse_scenario_refuses_invented_numbers(live):
    invented = {
        "hires": [{"role": "Fitter", "annual_salary": 45000, "count": 2, "start_period": "2027-03"}],
        "one_offs": [],
        "financing": [],
        "assumptions": [],
        "not_understood": "",
    }
    good = {
        **invented,
        "hires": [{"role": "Fitter", "annual_salary": 42000, "count": 2, "start_period": "2027-03"}],
        "financing": [{"kind": "loan", "amount": 50000, "period": "2027-05"}],
        "assumptions": [{"key": "debtorDays", "value": 40}],
    }
    route = respx.post(OPENROUTER).mock(side_effect=[reply(invented), reply(good)])
    out = parse_scenario(
        ParseScenarioRequest(
            text="Hire 2 fitters in March at 42k each, take a 50k loan in May, debtor days 40", start_period="2026-10"
        ),
        live,
    )
    assert route.call_count == 2
    assert out["hires"] == [{"role": "Fitter", "salaryCents": 4_200_000, "count": 2, "startPeriod": "2027-03"}]
    assert out["financing"][0]["amountCents"] == 5_000_000
    assert out["assumptions"] == [{"key": "debtorDays", "value": 40}]


@respx.mock
def test_import_map_keeps_only_real_columns_and_types(live):
    respx.post(OPENROUTER).mock(
        return_value=reply(
            {
                "columns": [
                    {"field": "code", "header": "Nominal"},
                    {"field": "name", "header": "Description"},
                    {"field": "type", "header": "Category"},
                ],
                "types": [{"raw": "Sales Ledger", "type": "REVENUE"}],
                "note": "Check the bank account.",
            }
        )
    )
    out = import_map(
        ImportMapRequest(
            file="accounts",
            headers=["Nominal", "Description", "Category"],
            unknown_types=["Sales Ledger"],
            allowed_types=["REVENUE", "BANK"],
        ),
        live,
    )
    assert out == {
        "columns": {"code": "Nominal", "name": "Description", "type": "Category"},
        "types": {"Sales Ledger": "REVENUE"},
        "note": "Check the bank account.",
    }


@respx.mock
def test_name_scenario_trims_suggestions(live):
    respx.post(OPENROUTER).mock(return_value=reply({"names": ['"Two hires, slower collections."', "x" * 80]}))
    assert name_scenario(NameScenarioRequest(changes="two hires, debtor days 56"), live) == {
        "names": ["Two hires, slower collections"]
    }


@respx.mock
def test_search_parse_checks_dates_amounts_and_accounts(live):
    bad = {
        "accounts": ["310"],
        "contact": "Liffey Timber Supplies",
        "words": "",
        "date_from": "2026-04-01",
        "date_to": "2026-06-30",
        "min_amount": 9000,
        "max_amount": None,
        "side": "credit",
    }
    good = {**bad, "min_amount": 5000}
    respx.post(OPENROUTER).mock(side_effect=[reply(bad), reply(good)])
    out = search_parse(
        SearchParseRequest(
            text="payments to Liffey over 5k in Q2",
            today="2026-10-21",
            accounts=[{"code": "310", "name": "Timber"}],
            contacts=["Liffey Timber Supplies"],
        ),
        live,
    )
    assert out == {
        "accounts": ["310"],
        "contact": "Liffey Timber Supplies",
        "words": "",
        "dateFrom": "2026-04-01",
        "dateTo": "2026-06-30",
        "minCents": 500_000,
        "maxCents": None,
        "side": "credit",
    }
