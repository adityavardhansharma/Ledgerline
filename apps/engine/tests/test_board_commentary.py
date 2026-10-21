"""The board pack's facts pack, the sectioned commentary and the questions endpoint."""

import importlib.util
import json
import sys
from pathlib import Path

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from ledgerline_engine.api import app
from ledgerline_engine.commentary.draft import ORDER, CommentaryInvalid, answer, draft, validate_sections
from ledgerline_engine.commentary.facts import BoardInput, Fact, build_facts
from ledgerline_engine.settings import Settings, get_settings

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sample_company", ROOT / "scripts" / "sample_company.py")
sample = importlib.util.module_from_spec(spec)
sys.modules["sample_company"] = sample
spec.loader.exec_module(sample)

OPENROUTER = "https://openrouter.ai/api/v1/chat/completions"


@pytest.fixture(scope="module")
def board():
    journals = sample.generate()
    accounts = [
        {"xero_account_id": f"csv:{c}", "code": c, "name": n, "type": t, "account_class": "", "system_account": s}
        for c, n, t, s in sample.ACCOUNTS
    ]
    totals: dict[tuple[str, str], int] = {}
    for j in journals:
        for code, value, _ in j.lines:
            key = (f"csv:{code}", j.date.strftime("%Y-%m"))
            totals[key] = totals.get(key, 0) + value
    balances = [{"xero_account_id": a, "period": p, "net_cents": v} for (a, p), v in totals.items()]
    return {"accounts": accounts, "balances": balances, "fy_start_month": 1, "as_of": "2026-09"}


def ids(facts):
    return {f.id: f for f in facts}


def test_five_years_of_history_give_every_comparison(board):
    facts, _ = build_facts(BoardInput(**board))
    found = ids(facts)
    for key in (
        "revenueVsPrev",
        "revenueVsLastYear",
        "revenueVs3m",
        "revenueYtdVsPrior",
        "grossMargin6mAgo",
        "breakEven",
        "mover1",
        "cashFromTrading",
        "debtorDays",
        "debtorDaysBefore",
    ):
        assert key in found, key
    assert found["month"].value == "September 2026"
    # Changes are a size and a direction: the label says which way, the value is never negative.
    assert all(not f.value.startswith("−") for f in facts if f.id.endswith(("VsPrev", "VsLastYear", "VsPrior")))
    assert found["revenueVsPrev"].label.split(":")[1].strip().startswith(("up", "down"))
    # Changes read as a percentage, with the amount alongside; a mover says both levels in one figure.
    assert found["revenueVsPrev"].value.endswith("%") and found["revenueVsPrevAmount"].value.startswith("€")
    assert found["mover1"].value.startswith("from €") and " to €" in found["mover1"].value


def test_a_short_history_skips_comparisons_it_cannot_make(board):
    recent = {**board, "balances": [b for b in board["balances"] if b["period"] >= "2026-06"]}
    found = ids(build_facts(BoardInput(**recent))[0])
    assert "revenueVsLastYear" not in found and "revenueYtdVsPrior" not in found
    assert "revenue" in found and "cash" in found


def test_forecast_scenarios_plan_customers_and_ageing_become_facts(board):
    months = [
        {
            "period": f"2026-{m:02d}" if m <= 12 else f"2027-{m - 12:02d}",
            "revenue": 20_000_000,
            "ebitda": 2_000_000,
            "cash": 30_000_000,
        }
        for m in range(10, 34)
    ]
    data = BoardInput(
        **board,
        forecast={
            "months": months,
            "runwayMonths": None,
            "cashOutPeriod": None,
            "lowestCash": 15_000_000,
            "lowestCashPeriod": "2027-01",
            "sensitivity": {"rows": [{"label": "Revenue growth", "range": "0% ↔ 2%", "low": -2.5, "high": 1.0}]},
        },
        scenarios=[{"name": "Second CNC", "changes": "one equipment purchase", "cashOutPeriod": "2027-08"}],
        plan={"madeAt": "2026-08", "revenue": 23_000_000, "ebitda": 3_000_000, "cash": 25_000_000},
        customers={
            "month": [{"contact": "Seaview Hotel", "value": 9_000_000}, {"contact": "Glenmore Developments", "value": 3_000_000}],
            "quarter": [
                {"contact": "Glenmore Developments", "value": 30_000_000},
                {"contact": "Seaview Hotel", "value": 10_000_000},
            ],
            "prior": ["Glenmore Developments"],
        },
        ageing={
            "asOf": "2026-10-01",
            "receivable": [
                {"label": "Not yet due", "value": 100},
                {"label": "1–30", "value": 200},
                {"label": "31–60", "value": 0},
                {"label": "61–90", "value": 300},
                {"label": "90+", "value": 400},
            ],
            "receivableTop": [{"contact": "Seaview Hotel", "value": 500}],
        },
        reconciliation={"status": "mismatch", "differences": [{}, {}]},
    )
    facts, signals = build_facts(data)
    found = ids(facts)
    assert found["runway"].value == "24 months"
    assert found["lowestCash"].value == "€150,000 in January 2027"
    assert found["topDriver"].value == "-2.5 to +1.0 months"
    assert "runs out" in found["scenario1"].label and found["scenario1"].value == "August 2027"
    assert found["revenueVsPlan"].label == "Revenue: above plan"
    assert found["customer1"].value.startswith("Seaview Hotel, €90,000 (75%")
    assert found["newCustomers"].value == "Seaview Hotel"
    assert found["topCustomerShare"].value == "Glenmore Developments, 75%"
    assert found["overdue60"].value == "€7"
    assert found["reconciled"].value == "2"
    assert {s["level"] for s in signals} >= {"red", "amber"}


FACTS = [
    Fact(id="month", label="Month", value="September 2026", source="Period"),
    Fact(id="revenue", label="Revenue", value="€228,900", source="Sales"),
    Fact(id="cash", label="Cash", value="€412,300", source="Bank"),
]


def seg(text, fact=""):
    return {"text": text, "fact": fact}


GOOD = {
    "headline": [[seg("Revenue was ", "revenue"), seg(" in ", "month")], [seg("Cash closed at ", "cash")]],
    "performance": [[seg("Sales held up at ", "revenue")]],
    "cash": [[seg("The bank balance is ", "cash")]],
    "outlook": [[seg("The outlook is steady.")]],
    "risks": [{"level": "amber", "title": "Customer concentration", "detail": [seg("One customer dominates.")]}],
    "decisions": [],
    "questions": [{"question": [seg("Is cash enough?")], "answer": [seg("Yes, at ", "cash")]}],
}


def test_sections_render_citations_with_their_fact_ids():
    out = validate_sections(GOOD, FACTS, ORDER)
    assert out["headline"][0] == [
        "Revenue was ",
        {"text": "€228,900", "source": "Revenue · Sales", "fact": "revenue"},
        " in ",
        {"text": "September 2026", "source": "Month · Period", "fact": "month"},
    ]
    assert out["risks"][0]["title"] == "Customer concentration"
    assert out["questions"][0]["answer"][1]["text"] == "€412,300"


@pytest.mark.parametrize(
    "bad",
    [
        {**GOOD, "performance": [[seg("Revenue grew 15%")]]},
        {**GOOD, "risks": [{"level": "red", "title": "Top 3 customers", "detail": []}]},
        {**GOOD, "outlook": [[seg("Unknown ", "ebitda")]]},
        {**GOOD, "headline": []},
        {**GOOD, "headline": [[seg("A ", "revenue"), seg(" B ", "cash"), seg(" C ", "month")]]},
    ],
)
def test_sections_reject_numbers_unknown_facts_and_an_empty_headline(bad):
    with pytest.raises(CommentaryInvalid):
        validate_sections(bad, FACTS, ORDER)


def reply(payload):
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(payload)}}]})


@respx.mock
def test_draft_retries_once_and_sends_notes_signals_and_tone(settings):
    settings.openrouter_api_key = "key"
    bad = {**GOOD, "cash": [[seg("Cash is 412,300")]]}
    route = respx.post(OPENROUTER).mock(side_effect=[reply(bad), reply(GOOD)])
    out = draft(FACTS, settings, signals=[{"level": "red", "text": "Loss"}], notes="Lost the Murphy contract", tone="investor")
    assert set(out) == set(ORDER)
    assert route.call_count == 2
    sent = json.loads(route.calls[0].request.content)
    prompt = sent["messages"][1]["content"]
    assert "Lost the Murphy contract" in prompt and "investors" in prompt and '"Loss"' in prompt
    assert sent["response_format"]["json_schema"]["schema"]["required"] == ORDER


@respx.mock
def test_one_section_is_redrafted_with_the_rest_as_context(settings):
    settings.openrouter_api_key = "key"
    route = respx.post(OPENROUTER).mock(return_value=reply({"cash": [[seg("Cash rose to ", "cash")]]}))
    current = validate_sections(GOOD, FACTS, ORDER)
    out = draft(FACTS, settings, section="cash", current=current)
    assert list(out) == ["cash"]
    sent = json.loads(route.calls[0].request.content)
    assert sent["response_format"]["json_schema"]["schema"]["required"] == ["cash"]
    assert "Revenue was €228,900" in sent["messages"][1]["content"]


@respx.mock
def test_answers_cite_facts_and_may_say_the_figures_cannot_tell(settings):
    settings.openrouter_api_key = "key"
    respx.post(OPENROUTER).mock(return_value=reply({"answer": [[seg("The figures don't show staff numbers.")]]}))
    out = answer(FACTS, "How many staff?", settings)
    assert out == [["The figures don't show staff numbers."]]


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    app.dependency_overrides[get_settings] = lambda: Settings(
        allow_unsigned=True, openrouter_api_key="key", xero_client_id="c", xero_client_secret="x"
    )
    yield TestClient(app)
    app.dependency_overrides.clear()
    get_settings.cache_clear()


@respx.mock
def test_draft_endpoint_builds_the_facts_and_returns_them(api, board):
    def respond(request):
        facts = json.loads(request.content)["messages"][1]["content"]
        assert '"revenueVsLastYear"' in facts
        return reply({**GOOD, "headline": [[seg("Revenue was ", "revenue")]]})

    respx.post(OPENROUTER).mock(side_effect=respond)
    response = api.post("/commentary/draft", json={**board, "notes": "Won Seaview", "tone": "brief"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sections"]["headline"][0][1]["fact"] == "revenue"
    assert any(f["id"] == "breakEven" for f in body["facts"])


@respx.mock
def test_customer_revenue_endpoint_groups_sales_by_customer(api):
    xero = "https://api.xero.com/api.xro/2.0"
    invoices = [
        {
            "Type": "ACCREC",
            "Status": "PAID",
            "Contact": {"Name": "Seaview Hotel"},
            "DateString": "2026-09-10T00:00:00",
            "SubTotal": 1000,
        },
        {
            "Type": "ACCREC",
            "Status": "AUTHORISED",
            "Contact": {"Name": "Glenmore"},
            "DateString": "2026-08-10T00:00:00",
            "SubTotal": 500,
        },
        {
            "Type": "ACCREC",
            "Status": "DRAFT",
            "Contact": {"Name": "Ignored"},
            "DateString": "2026-09-11T00:00:00",
            "SubTotal": 900,
        },
        {
            "Type": "ACCPAY",
            "Status": "PAID",
            "Contact": {"Name": "Supplier"},
            "DateString": "2026-09-11T00:00:00",
            "SubTotal": 900,
        },
    ]
    respx.get(f"{xero}/Invoices").mock(return_value=httpx.Response(200, json={"Invoices": invoices}))
    respx.get(f"{xero}/CreditNotes").mock(return_value=httpx.Response(403, json={}))
    tenant = {"tokens": {"access_token": "a", "refresh_token": "r", "expires_at": 4_000_000_000}, "tenant_id": "t"}
    response = api.post("/xero/customer-revenue", json={**tenant, "period": "2026-09"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["month"] == [{"contact": "Seaview Hotel", "value": 100_000}]
    assert {r["contact"] for r in body["quarter"]} == {"Seaview Hotel", "Glenmore"}
    assert body["prior"] == ["Glenmore"]
