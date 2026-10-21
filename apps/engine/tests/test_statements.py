from hypothesis import given, settings
from hypothesis import strategies as st

from ledgerline_engine.statements.build import (
    Ledger,
    build_all,
    cash_flow_lines,
    fy_start,
    period_add,
    period_range,
)
from ledgerline_engine.statements.classify import Line, classify

from .fixtures import ACCOUNTS, balances_from, month_journals, opening_journals


def sample(months=9, base=18_000_000):
    journals = {"2025-12": opening_journals()}
    for index, period in enumerate(period_range("2026-01", period_add("2026-01", months - 1))):
        journals[period] = month_journals(period, base + index * 500_000)
    return balances_from(journals)


def test_periods():
    assert period_add("2026-11", 3) == "2027-02"
    assert period_add("2026-01", -1) == "2025-12"
    assert fy_start("2026-03", 4) == "2025-04"
    assert fy_start("2026-09", 1) == "2026-01"


def test_classification():
    lines = {a["xero_account_id"]: classify(a).line for a in ACCOUNTS}
    assert lines["bank"] == Line.CASH and lines["debtors"] == Line.DEBTORS
    assert lines["vat"] == Line.TAX_LIABILITY and lines["ct"] == Line.TAX_LIABILITY
    assert lines["loan"] == Line.LOAN and lines["dep"] == Line.DEPRECIATION
    assert lines["interest"] == Line.INTEREST and lines["taxexp"] == Line.TAX
    assert lines["wages"] == Line.OVERHEADS and classify(ACCOUNTS[11]).is_wages


def test_pnl_signs_and_totals():
    result = build_all(ACCOUNTS, sample(), 1, "2026-09")
    rows = {r["label"]: r for r in result["pnl"]["rows"] if "values" in r}
    sales = rows["Sales"]["values"]
    assert sales[0] == 18_000_000 and sales[8] == 22_000_000
    assert sales[9] is None and sales[11] is None  # future months are blank, never zero
    assert rows["Cost of sales"]["values"][0] == -10_440_000
    gross = rows["Gross profit"]["values"]
    assert gross[0] == 18_000_000 - 10_440_000
    net = rows["Net profit"]["values"]
    assert net[-1] == sum(v for v in net[:9])  # year-to-date column is the sum of actual months
    assert result["pnl"]["columns"][9]["kind"] == "F"


def test_balance_sheet_balances_and_earnings_roll():
    result = build_all(ACCOUNTS, sample(), 1, "2026-09")
    bs = {r["label"]: r for r in result["balance"]["rows"] if "values" in r}
    assert bs["Net assets"]["values"] == bs["Total equity"]["values"]
    pnl_net_ytd = next(r for r in result["pnl"]["rows"] if r["label"] == "Net profit")["values"][-1]
    assert bs["Current year earnings"]["values"][1] == pnl_net_ytd


def test_cash_flow_closes_to_the_bank():
    result = build_all(ACCOUNTS, sample(), 1, "2026-09")
    rows = {r["label"]: r for r in result["cashflow"]["rows"] if "values" in r}
    month, ytd = rows["Closing cash"]["values"]
    assert month == ytd
    bridge = result["bridge"]
    assert bridge[0]["value"] + sum(s["value"] for s in bridge[1:-1]) == bridge[-1]["value"]


def test_measures_and_drivers():
    result = build_all(ACCOUNTS, sample(), 1, "2026-09")
    m = result["measures"]
    assert m["revenue"] == 22_000_000
    assert abs(m["grossMargin"] - 0.42) < 0.001
    assert m["debtorDays"] > 0
    d = result["drivers"]
    assert d["startPeriod"] == "2026-10"
    assert 0 < d["growth"] < 0.05
    assert d["opening"]["cash"] == m["cash"]
    assert d["loanRepaymentMonthly"] == 140_000


def test_sankey_flows_balance():
    sankey = build_all(ACCOUNTS, sample(), 1, "2026-09")["sankey"]
    totals = {}
    for link in sankey["links"]:
        totals.setdefault(link["source"], 0)
        totals[link["source"]] += link["value"]
    revenue_in = 22_000_000
    assert totals["rev"] == revenue_in


journal_strategy = st.lists(
    st.tuples(
        st.sampled_from([a["xero_account_id"] for a in ACCOUNTS]),
        st.sampled_from([a["xero_account_id"] for a in ACCOUNTS]),
        st.integers(min_value=1, max_value=50_000_000),
        st.sampled_from(period_range("2025-01", "2026-09")),
    ),
    min_size=1,
    max_size=60,
)


@settings(max_examples=150, deadline=None)
@given(journal_strategy)
def test_any_balanced_ledger_produces_consistent_statements(entries):
    journals: dict[str, list] = {}
    for debit, credit, amount, period in entries:
        journals.setdefault(period, []).append([(debit, amount), (credit, -amount)])
    balances = balances_from(journals)
    ledger = Ledger.from_payload(ACCOUNTS, balances)
    # The builder raises StatementError if anything fails to tie out.
    result = build_all(ACCOUNTS, balances, 1, "2026-09")
    bs = {r["label"]: r for r in result["balance"]["rows"] if "values" in r}
    assert bs["Net assets"]["values"] == bs["Total equity"]["values"]
    flow = cash_flow_lines(ledger, "2026-01", "2026-09")
    assert flow["opening_cash"] + flow["net_change"] == flow["closing_cash"]
    for row in result["pnl"]["rows"] + result["balance"]["rows"] + result["cashflow"]["rows"]:
        for value in row.get("values", []):
            assert value is None or isinstance(value, int)
