"""Driver-based three-statement forecast.

Every month produces a P&L, a balance sheet and a cash flow that agree with each other. The model never
inserts a balancing figure: if assets minus liabilities stops equalling equity, it raises.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field, replace
from decimal import Decimal

from pydantic import BaseModel, Field

from ..money import ZERO, from_cents, to_cents
from ..statements.build import period_add, period_label

D = Decimal
TOLERANCE = D("0.005")


class Opening(BaseModel):
    cash: int = 0
    debtors: int = 0
    stock: int = 0
    otherCurrentAssets: int = 0
    fixedAssets: int = 0
    creditors: int = 0
    taxPayable: int = 0
    otherCurrentLiabilities: int = 0
    loan: int = 0


class Drivers(BaseModel):
    startPeriod: str
    revenueLastMonth: int
    growth: float = 0.0
    grossMargin: float = 0.4
    overheadsMonthly: int = 0
    wagesMonthly: int = 0
    overheadGrowth: float = 0.04
    depreciationMonthly: int = 0
    interestRate: float = 0.0
    loanRepaymentMonthly: int = 0
    taxRate: float = 0.125
    debtorDays: float = 30
    creditorDays: float = 30
    stockDays: float = 0
    usefulLifeMonths: int = 60
    employerOnCost: float = 0.1115
    taxPaymentMonths: list[int] = Field(default_factory=lambda: [6, 11])
    opening: Opening = Field(default_factory=Opening)


class Hire(BaseModel):
    role: str
    salaryCents: int  # annual
    startPeriod: str
    count: int = 1


class OneOff(BaseModel):
    label: str
    period: str
    amountCents: int
    kind: str = "capex"  # capex | income | expense


class Financing(BaseModel):
    period: str
    kind: str  # loan | equity | dividend
    amountCents: int


class ForecastRequest(BaseModel):
    drivers: Drivers
    hires: list[Hire] = Field(default_factory=list)
    oneOffs: list[OneOff] = Field(default_factory=list)
    financing: list[Financing] = Field(default_factory=list)
    horizon: int = Field(default=24, ge=1, le=60)
    seed: int = 7
    bands: bool = True
    sensitivity: bool = True


class ForecastImbalance(AssertionError):
    pass


@dataclass
class State:
    cash: D
    debtors: D
    stock: D
    other_assets: D
    fixed: D
    creditors: D
    tax_payable: D
    other_liabilities: D
    loan: D
    equity: D

    @property
    def assets(self) -> D:
        return self.cash + self.debtors + self.stock + self.other_assets + self.fixed

    @property
    def liabilities(self) -> D:
        return self.creditors + self.tax_payable + self.other_liabilities + self.loan


@dataclass
class Month:
    period: str
    revenue: D
    cogs: D
    overheads: D
    hire_cost: D
    depreciation: D
    interest: D
    tax: D
    tax_paid: D
    capex: D
    one_off_income: D
    state: State
    operating: D = ZERO
    investing: D = ZERO
    financing: D = ZERO

    @property
    def gross_profit(self) -> D:
        return self.revenue - self.cogs

    @property
    def ebitda(self) -> D:
        return self.gross_profit - self.overheads - self.hire_cost + self.one_off_income

    @property
    def net_profit(self) -> D:
        return self.ebitda - self.depreciation - self.interest - self.tax


@dataclass
class Result:
    months: list[Month] = field(default_factory=list)
    opening_cash: D = ZERO


def _d(value: float) -> D:
    return D(str(round(value, 6)))


def run_model(request: ForecastRequest, drivers: Drivers | None = None) -> Result:
    dr = drivers or request.drivers
    o = dr.opening
    state = State(
        cash=from_cents(o.cash),
        debtors=from_cents(o.debtors),
        stock=from_cents(o.stock),
        other_assets=from_cents(o.otherCurrentAssets),
        fixed=from_cents(o.fixedAssets),
        creditors=from_cents(o.creditors),
        tax_payable=from_cents(o.taxPayable),
        other_liabilities=from_cents(o.otherCurrentLiabilities),
        loan=from_cents(o.loan),
        equity=ZERO,
    )
    state.equity = state.assets - state.liabilities

    growth, margin = _d(dr.growth), _d(dr.grossMargin)
    rate, tax_rate = _d(dr.interestRate), _d(dr.taxRate)
    on_cost = 1 + _d(dr.employerOnCost)
    revenue = from_cents(dr.revenueLastMonth)
    base_overheads = from_cents(dr.overheadsMonthly)
    non_wage_share = (base_overheads - from_cents(dr.wagesMonthly)) / base_overheads if base_overheads > 0 else D(1)
    base_dep = from_cents(dr.depreciationMonthly)
    capex_to_date = ZERO
    result = Result(opening_cash=state.cash)

    for t in range(1, request.horizon + 1):
        period = period_add(dr.startPeriod, t - 1)
        prev = state
        revenue = revenue * (1 + growth)
        cogs = revenue * (1 - margin)
        overheads = base_overheads * _d((1 + dr.overheadGrowth) ** (t / 12))
        hire_cost = sum(
            (from_cents(h.salaryCents) / 12 * on_cost * h.count for h in request.hires if h.startPeriod <= period), ZERO
        )
        capex = sum((from_cents(x.amountCents) for x in request.oneOffs if x.period == period and x.kind == "capex"), ZERO)
        income = sum((from_cents(x.amountCents) for x in request.oneOffs if x.period == period and x.kind == "income"), ZERO)
        income -= sum((from_cents(x.amountCents) for x in request.oneOffs if x.period == period and x.kind == "expense"), ZERO)
        capex_to_date += capex
        depreciation = min(prev.fixed + capex, base_dep + capex_to_date / dr.usefulLifeMonths)
        depreciation = max(depreciation, ZERO)
        interest = prev.loan * rate / 12
        pbt = revenue - cogs - overheads - hire_cost + income - depreciation - interest
        tax = max(pbt, ZERO) * tax_rate
        month_number = int(period[5:7])
        tax_due = prev.tax_payable + tax
        tax_paid = tax_due if month_number in dr.taxPaymentMonths and tax_due > 0 else ZERO

        drawn = sum((from_cents(f.amountCents) for f in request.financing if f.period == period and f.kind == "loan"), ZERO)
        raised = sum((from_cents(f.amountCents) for f in request.financing if f.period == period and f.kind == "equity"), ZERO)
        dividends = sum(
            (from_cents(f.amountCents) for f in request.financing if f.period == period and f.kind == "dividend"), ZERO
        )
        repayment = min(prev.loan, from_cents(dr.loanRepaymentMonthly))

        purchases = cogs + (overheads * non_wage_share)
        month = Month(
            period=period,
            revenue=revenue,
            cogs=cogs,
            overheads=overheads,
            hire_cost=hire_cost,
            depreciation=depreciation,
            interest=interest,
            tax=tax,
            tax_paid=tax_paid,
            capex=capex,
            one_off_income=income,
            state=prev,
        )
        net = month.net_profit
        new = replace(
            prev,
            debtors=revenue * _d(dr.debtorDays) / 30,
            stock=cogs * _d(dr.stockDays) / 30,
            creditors=purchases * _d(dr.creditorDays) / 30,
            fixed=prev.fixed + capex - depreciation,
            tax_payable=tax_due - tax_paid,
            loan=prev.loan - repayment + drawn,
            equity=prev.equity + net + raised - dividends,
        )
        operating = net + depreciation - (new.debtors - prev.debtors) - (new.stock - prev.stock)
        operating += (new.creditors - prev.creditors) + (new.tax_payable - prev.tax_payable)
        investing = -capex
        financing = (new.loan - prev.loan) + raised - dividends
        new.cash = prev.cash + operating + investing + financing
        if abs(new.assets - new.liabilities - new.equity) > TOLERANCE:
            raise ForecastImbalance(f"{period}: assets - liabilities - equity = {new.assets - new.liabilities - new.equity}")
        month.state = new
        month.operating, month.investing, month.financing = operating, investing, financing
        result.months.append(month)
        state = new
    return result


def runway(result: Result) -> tuple[float | None, str | None]:
    """Months until cash first goes below zero, interpolated within the month, and that month."""
    previous = result.opening_cash
    if previous < 0:
        return 0.0, result.months[0].period if result.months else None
    for index, month in enumerate(result.months):
        cash = month.state.cash
        if cash < 0:
            fraction = previous / (previous - cash) if previous != cash else D(0)
            return float(round(D(index) + fraction, 1)), month.period
        previous = cash
    return None, None


def summarise(result: Result) -> dict:
    months = []
    for m in result.months:
        s = m.state
        months.append(
            {
                "period": m.period,
                "label": period_label(m.period),
                "revenue": to_cents(m.revenue),
                "costOfSales": to_cents(-m.cogs),
                "grossProfit": to_cents(m.gross_profit),
                "overheads": to_cents(-m.overheads),
                "hires": to_cents(-m.hire_cost),
                "oneOffs": to_cents(m.one_off_income),
                "ebitda": to_cents(m.ebitda),
                "depreciation": to_cents(-m.depreciation),
                "interest": to_cents(-m.interest),
                "tax": to_cents(-m.tax),
                "netProfit": to_cents(m.net_profit),
                "cash": to_cents(s.cash),
                "debtors": to_cents(s.debtors),
                "stock": to_cents(s.stock),
                "fixedAssets": to_cents(s.fixed),
                "creditors": to_cents(s.creditors),
                "taxPayable": to_cents(s.tax_payable),
                "loan": to_cents(s.loan),
                "equity": to_cents(s.equity),
                "operating": to_cents(m.operating),
                "investing": to_cents(m.investing),
                "financing": to_cents(m.financing),
            }
        )
    months_runway, cash_out = runway(result)
    lowest = min(result.months, key=lambda m: m.state.cash) if result.months else None
    return {
        "months": months,
        "runwayMonths": months_runway,
        "cashOutPeriod": cash_out,
        "lowestCash": to_cents(lowest.state.cash) if lowest else None,
        "lowestCashPeriod": lowest.period if lowest else None,
        "endCash": to_cents(result.months[-1].state.cash) if result.months else None,
        "revenueFirst12": to_cents(sum((m.revenue for m in result.months[:12]), ZERO)),
        "ebitdaFirst12": to_cents(sum((m.ebitda for m in result.months[:12]), ZERO)),
    }


def bands(request: ForecastRequest, runs: int = 200) -> dict:
    """P10/P25/P75/P90 month-end cash from seeded perturbations of the uncertain drivers."""
    rng = random.Random(request.seed)
    base = request.drivers
    paths: list[list[int]] = []
    for _ in range(runs):
        drivers = base.model_copy(
            update={
                "growth": base.growth + rng.gauss(0, 0.005),
                "grossMargin": min(0.95, max(0.0, base.grossMargin + rng.gauss(0, 0.01))),
                "debtorDays": max(0.0, base.debtorDays + rng.gauss(0, 5)),
            }
        )
        paths.append([to_cents(m.state.cash) for m in run_model(request, drivers).months])

    def pct(values: list[int], q: float) -> int:
        ordered = sorted(values)
        return ordered[min(len(ordered) - 1, int(q * (len(ordered) - 1) + 0.5))]

    columns = list(zip(*paths, strict=True))
    return {key: [pct(list(col), q) for col in columns] for key, q in (("p10", 0.1), ("p25", 0.25), ("p75", 0.75), ("p90", 0.9))}


SENSITIVITIES = [
    ("debtorDays", "Debtor days", 10, "{:.0f} ↔ {:.0f} days", True),
    ("growth", "Revenue growth", 0.01, "{:.1%} ↔ {:.1%} a month", False),
    ("grossMargin", "Gross margin", 0.02, "{:.0%} ↔ {:.0%}", False),
    ("creditorDays", "Creditor days", 10, "{:.0f} ↔ {:.0f} days", False),
    ("overheadGrowth", "Overheads growth", 0.04, "{:.0%} ↔ {:.0%} a year", True),
]


def sensitivity(request: ForecastRequest) -> dict:
    """How far runway moves when each driver goes to its downside and upside, others held."""
    horizon = float(request.horizon)

    def months_of(drivers: Drivers, hires: list[Hire] | None = None) -> float:
        req = request.model_copy(update={"hires": hires if hires is not None else request.hires})
        value, _ = runway(run_model(req, drivers))
        return horizon if value is None else value

    base_value = months_of(request.drivers)
    rows = []
    for key, label, step, fmt, higher_is_worse in SENSITIVITIES:
        current = getattr(request.drivers, key)
        low_value = current - step
        high_value = current + step
        a = months_of(request.drivers.model_copy(update={key: low_value}))
        b = months_of(request.drivers.model_copy(update={key: high_value}))
        downside, upside = (b, a) if higher_is_worse else (a, b)
        range_text = fmt.format(*(sorted([low_value, high_value], reverse=higher_is_worse)))
        rows.append(
            {"label": label, "range": range_text, "low": round(downside - base_value, 1), "high": round(upside - base_value, 1)}
        )
    if request.hires:
        earlier = [h.model_copy(update={"startPeriod": period_add(h.startPeriod, -3)}) for h in request.hires]
        later = [h.model_copy(update={"startPeriod": period_add(h.startPeriod, 3)}) for h in request.hires]
        rows.append(
            {
                "label": "Timing of hires",
                "range": "3 months earlier ↔ later",
                "low": round(months_of(request.drivers, earlier) - base_value, 1),
                "high": round(months_of(request.drivers, later) - base_value, 1),
            }
        )
    rows.sort(key=lambda r: -(abs(r["low"]) + abs(r["high"])))
    return {"base": round(base_value, 1), "rows": rows, "capped": base_value >= horizon}


def forecast(request: ForecastRequest) -> dict:
    result = run_model(request)
    out = summarise(result)
    if request.bands:
        out["bands"] = bands(request)
    if request.sensitivity:
        out["sensitivity"] = sensitivity(request)
    return out
