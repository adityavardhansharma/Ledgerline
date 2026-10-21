from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st

from ledgerline_engine.forecast.model import (
    Drivers,
    Financing,
    ForecastRequest,
    Hire,
    OneOff,
    Opening,
    forecast,
    run_model,
    runway,
)

KESTREL = Drivers(
    startPeriod="2026-10",
    revenueLastMonth=22_890_000,
    growth=0.0,
    grossMargin=0.42,
    overheadsMonthly=6_830_000,
    wagesMonthly=4_920_000,
    overheadGrowth=0.0,
    depreciationMonthly=310_000,
    interestRate=0.05,
    loanRepaymentMonthly=200_000,
    debtorDays=41,
    creditorDays=32,
    stockDays=0,
    opening=Opening(
        cash=41_230_000,
        debtors=26_840_000,
        stock=9_620_000,
        fixedAssets=18_400_000,
        creditors=14_270_000,
        taxPayable=6_050_000,
        loan=12_000_000,
    ),
)


def test_balance_sheet_balances_every_month_and_shape():
    out = forecast(ForecastRequest(drivers=KESTREL, horizon=24, bands=False, sensitivity=False))
    assert len(out["months"]) == 24
    first = out["months"][0]
    assert first["period"] == "2026-10" and first["label"] == "Oct 26"
    assert first["revenue"] == 22_890_000
    assert first["costOfSales"] == -13_276_200


def test_hires_reduce_runway_and_cost_includes_prsi():
    base = run_model(ForecastRequest(drivers=KESTREL, horizon=36))
    hired_req = ForecastRequest(
        drivers=KESTREL, horizon=36, hires=[Hire(role="Cabinet maker", salaryCents=6_750_000, startPeriod="2027-01", count=2)]
    )
    hired = run_model(hired_req)
    jan = next(m for m in hired.months if m.period == "2027-01")
    assert round(jan.hire_cost, 2) == Decimal("12504.38")
    assert hired.months[-1].state.cash < base.months[-1].state.cash


def test_runway_interpolates():
    burning = KESTREL.model_copy(update={"revenueLastMonth": 10_000_000})
    months, period = runway(run_model(ForecastRequest(drivers=burning, horizon=36)))
    assert months is not None and period is not None
    assert 0 < months < 36


def test_equity_and_loans_move_cash():
    req = ForecastRequest(
        drivers=KESTREL,
        horizon=6,
        financing=[
            Financing(period="2026-11", kind="equity", amountCents=10_000_000),
            Financing(period="2026-12", kind="loan", amountCents=5_000_000),
        ],
        oneOffs=[OneOff(label="CNC router", period="2026-11", amountCents=4_500_000, kind="capex")],
    )
    plain = run_model(ForecastRequest(drivers=KESTREL, horizon=6))
    funded = run_model(req)
    assert funded.months[-1].state.loan > plain.months[-1].state.loan
    assert funded.months[1].state.fixed > plain.months[1].state.fixed


def test_bands_and_sensitivity_are_reproducible():
    req = ForecastRequest(
        drivers=KESTREL.model_copy(update={"revenueLastMonth": 15_000_000}),
        horizon=24,
        hires=[Hire(role="Maker", salaryCents=6_000_000, startPeriod="2027-01")],
    )
    a, b = forecast(req), forecast(req)
    assert a["bands"] == b["bands"]
    for p10, p90 in zip(a["bands"]["p10"], a["bands"]["p90"], strict=True):
        assert p10 <= p90
    labels = [r["label"] for r in a["sensitivity"]["rows"]]
    assert "Debtor days" in labels and "Timing of hires" in labels
    debtor = next(r for r in a["sensitivity"]["rows"] if r["label"] == "Debtor days")
    assert debtor["low"] <= 0 <= debtor["high"]


@settings(max_examples=60, deadline=None)
@given(
    growth=st.floats(-0.05, 0.1),
    margin=st.floats(0.05, 0.9),
    debtor_days=st.floats(0, 120),
    creditor_days=st.floats(0, 120),
    stock_days=st.floats(0, 90),
    cash=st.integers(-5_000_000, 100_000_000),
    loan=st.integers(0, 50_000_000),
)
def test_any_drivers_keep_the_balance_sheet_balanced(growth, margin, debtor_days, creditor_days, stock_days, cash, loan):
    drivers = KESTREL.model_copy(
        update={
            "growth": growth,
            "grossMargin": margin,
            "debtorDays": debtor_days,
            "creditorDays": creditor_days,
            "stockDays": stock_days,
            "opening": KESTREL.opening.model_copy(update={"cash": cash, "loan": loan}),
        }
    )
    # run_model raises ForecastImbalance if any month fails assets - liabilities == equity
    out = forecast(ForecastRequest(drivers=drivers, horizon=18, bands=False, sensitivity=False))
    for month in out["months"]:
        assert all(isinstance(v, int) for k, v in month.items() if k not in ("period", "label"))
