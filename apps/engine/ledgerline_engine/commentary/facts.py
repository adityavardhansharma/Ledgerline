"""Every figure a board pack's commentary may cite, computed from the ledger, the forecast and Xero.

The model never writes a number: it cites these facts by id and the engine inserts the value. So the quality of
the commentary is bounded by this pack. It carries comparisons (previous month, same month last year, the
three months before, year to date against last year, actual against the plan), the accounts that moved most,
the cash bridge and working capital, what customers owe and who bought, the forecast's outlook and scenarios,
and signals worth a board's attention. Changes are a size and a direction ("down", "€3,200"), never a signed
number, so the prose can't say "fell by -€3,200".
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field

from ..money import ZERO, to_cents
from ..statements.build import Ledger, cash_flow_lines, fy_start, period_add
from ..statements.classify import Line

MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


class Fact(BaseModel):
    id: str
    label: str
    value: str
    source: str
    group: str = ""


class BoardInput(BaseModel):
    accounts: list[dict]
    balances: list[dict]
    fy_start_month: int = Field(default=1, ge=1, le=12)
    as_of: str
    # The base-case forecast's summary (runwayMonths, cashOutPeriod, lowestCash, lowestCashPeriod, months, sensitivity).
    forecast: dict | None = None
    # Branches of the base case: name, what they change, and their forecast summary.
    scenarios: list[dict] = []
    # Unpaid invoices and bills by age, from Xero.
    ageing: dict | None = None
    # The last check of our statements against Xero's own reports.
    reconciliation: dict | None = None
    # What the base case forecast for this month when it was made (revenue, ebitda, netProfit, cash, madeAt).
    plan: dict | None = None
    # Net sales by customer: {"month": [{contact, value}], "quarter": [...], "prior": [names seen before]}.
    customers: dict | None = None


def month_name(period: str) -> str:
    return f"{MONTHS[int(period[5:7]) - 1]} {period[:4]}"


def eur(cents: int | Decimal) -> str:
    c = int(cents)
    return f"{'−' if c < 0 else ''}€{abs(c) / 100:,.0f}"


def pct(x: float | Decimal, places: int = 1) -> str:
    return f"{abs(float(x)) * 100:.{places}f}%"


def months_text(x: float) -> str:
    return f"{x:.1f} months"


class Pack:
    def __init__(self) -> None:
        self.facts: list[Fact] = []

    def add(self, group: str, id: str, label: str, value: str, source: str) -> None:
        self.facts.append(Fact(id=id, label=label, value=value, source=source, group=group))

    def change(self, group: str, id: str, what: str, now: Decimal, before: Decimal, basis: str, source: str) -> None:
        """A change as a size and a direction, with the percentage when it means something."""
        diff = now - before
        if to_cents(diff) == 0:
            self.add(group, id, f"{what}: unchanged on {basis}", eur(0), source)
            return
        word = "up" if diff > 0 else "down"
        value = eur(abs(to_cents(diff)))
        if before > 0:
            value += f" ({pct(diff / before)})"
        self.add(group, id, f"{what}: {word} on {basis}", value, source)


def _measures(ledger: Ledger, start: str, end: str) -> dict[str, Decimal]:
    revenue = ledger.pnl(Line.REVENUE, start, end)
    gross = revenue + ledger.pnl(Line.COST_OF_SALES, start, end)
    overheads = -ledger.pnl(Line.OVERHEADS, start, end)
    return {
        "revenue": revenue,
        "gross": gross,
        "overheads": overheads,
        "ebitda": gross - overheads,
        "net": ledger.net_profit(start, end),
    }


def build_facts(data: BoardInput) -> tuple[list[Fact], list[dict]]:
    """The facts pack, and signals (plain-words hints, no figures) for the risks section."""
    ledger = Ledger.from_payload(data.accounts, data.balances)
    periods = ledger.periods()
    m = data.as_of
    first = periods[0] if periods else m
    # The first stored period holds opening balances (or Xero's year to date), so P&L comparisons start after it.
    has = lambda p: p > first  # noqa: E731
    pack = Pack()
    signals: list[dict] = []
    month = month_name(m)
    pack.add("context", "month", "The month this pack reports on", month, "Reporting period")

    # ---------- performance ----------
    now = _measures(ledger, m, m)
    prev_p = period_add(m, -1)
    ly_p = period_add(m, -12)
    pack.add("performance", "revenue", f"Revenue in {month}", eur(to_cents(now["revenue"])), "Sales accounts")
    if has(prev_p):
        prev = _measures(ledger, prev_p, prev_p)
        pack.change(
            "performance",
            "revenueVsPrev",
            "Revenue",
            now["revenue"],
            prev["revenue"],
            "the previous month",
            "Revenue, month on month",
        )
    if has(ly_p):
        ly = _measures(ledger, ly_p, ly_p)
        pack.change(
            "performance",
            "revenueVsLastYear",
            "Revenue",
            now["revenue"],
            ly["revenue"],
            f"{month_name(ly_p)}",
            "Revenue, same month last year",
        )
    if has(period_add(m, -3)):
        avg3 = _measures(ledger, period_add(m, -3), prev_p)
        pack.change(
            "performance",
            "revenueVs3m",
            "Revenue",
            now["revenue"],
            avg3["revenue"] / 3,
            "the average of the three months before",
            "Revenue against its recent run rate",
        )

    margin = now["gross"] / now["revenue"] if now["revenue"] > 0 else None
    if margin is not None:
        pack.add("performance", "grossMargin", "Gross margin", pct(margin), "Gross profit ÷ revenue")
        pack.add("performance", "grossProfit", "Gross profit", eur(to_cents(now["gross"])), "Revenue less cost of sales")
        if has(prev_p):
            prev = _measures(ledger, prev_p, prev_p)
            if prev["revenue"] > 0:
                d = margin - prev["gross"] / prev["revenue"]
                pack.add(
                    "performance",
                    "grossMarginVsPrev",
                    f"Gross margin: {'up' if d > 0 else 'down'} on the previous month",
                    f"{abs(float(d)) * 100:.1f} percentage points",
                    "Gross margin, month on month",
                )
        six = period_add(m, -6)
        if has(six):
            then = _measures(ledger, six, six)
            if then["revenue"] > 0:
                pack.add(
                    "performance",
                    "grossMargin6mAgo",
                    f"Gross margin six months earlier, in {month_name(six)}",
                    pct(then["gross"] / then["revenue"]),
                    "Gross profit ÷ revenue",
                )
                if margin < then["gross"] / then["revenue"] - Decimal("0.02"):
                    signals.append({"level": "amber", "text": "Gross margin has fallen over the last six months"})

    pack.add("performance", "overheads", "Overheads in the month", eur(to_cents(now["overheads"])), "Operating expenses")
    if now["revenue"] > 0:
        pack.add(
            "performance",
            "overheadShare",
            "Overheads as a share of revenue",
            pct(now["overheads"] / now["revenue"]),
            "Overheads ÷ revenue",
        )

    if now["ebitda"] == now["net"]:
        label = (
            "EBITDA and net profit (equal: no depreciation, interest or tax)"
            if now["net"] >= 0
            else "Loss for the month (EBITDA and net result are equal)"
        )
        pack.add(
            "performance",
            "netProfit",
            label,
            eur(abs(to_cents(now["net"]))) if now["net"] < 0 else eur(to_cents(now["net"])),
            "Profit and loss",
        )
    else:
        pack.add(
            "performance",
            "ebitda",
            "EBITDA" if now["ebitda"] >= 0 else "EBITDA loss",
            eur(abs(to_cents(now["ebitda"]))),
            "Profit and loss",
        )
        pack.add(
            "performance",
            "netProfit",
            "Net profit" if now["net"] >= 0 else "Net loss",
            eur(abs(to_cents(now["net"]))),
            "Profit and loss, after depreciation, interest and tax",
        )
    if now["net"] < 0:
        signals.append({"level": "red", "text": "The month made a loss"})
    if has(ly_p):
        ly = _measures(ledger, ly_p, ly_p)
        pack.change(
            "performance",
            "netProfitVsLastYear",
            "Net profit",
            now["net"],
            ly["net"],
            month_name(ly_p),
            "Net profit, same month last year",
        )

    # Year to date against the same months last year.
    fy_first = fy_start(m, data.fy_start_month)
    ytd = _measures(ledger, fy_first, m)
    pack.add(
        "performance",
        "revenueYtd",
        f"Revenue for the financial year to date ({month_name(fy_first)} to {month_name(m)})",
        eur(to_cents(ytd["revenue"])),
        "Sales accounts, year to date",
    )
    pack.add(
        "performance",
        "netProfitYtd",
        "Net profit for the year to date" if ytd["net"] >= 0 else "Net loss for the year to date",
        eur(abs(to_cents(ytd["net"]))),
        "Profit and loss, year to date",
    )
    if has(period_add(fy_first, -12)):
        prior = _measures(ledger, period_add(fy_first, -12), period_add(m, -12))
        pack.change(
            "performance",
            "revenueYtdVsPrior",
            "Year-to-date revenue",
            ytd["revenue"],
            prior["revenue"],
            "the same months last year",
            "Revenue, year to date against last year",
        )
        pack.change(
            "performance",
            "netProfitYtdVsPrior",
            "Year-to-date net profit",
            ytd["net"],
            prior["net"],
            "the same months last year",
            "Net profit, year to date against last year",
        )

    # Break-even: the revenue that covers overheads at the recent gross margin.
    if has(period_add(m, -2)):
        recent = _measures(ledger, period_add(m, -2), m)
        if recent["revenue"] > 0 and recent["gross"] > 0:
            breakeven = (recent["overheads"] / 3) / (recent["gross"] / recent["revenue"])
            pack.add(
                "performance",
                "breakEven",
                "Monthly revenue needed to cover overheads (at the last three months' margin)",
                eur(to_cents(breakeven)),
                "Overheads ÷ gross margin, last three months",
            )
            headroom = now["revenue"] - breakeven
            pack.add(
                "performance",
                "breakEvenHeadroom",
                "Revenue this month " + ("above" if headroom >= 0 else "below") + " break-even",
                eur(abs(to_cents(headroom))),
                "Revenue less break-even revenue",
            )
            if headroom < 0:
                signals.append({"level": "red", "text": "Revenue is below the level that covers overheads"})

    # The accounts that moved most against the previous month.
    if has(prev_p):
        moves = []
        for line, kind in ((Line.REVENUE, "income"), (Line.COST_OF_SALES, "direct cost"), (Line.OVERHEADS, "overhead")):
            for account_id in ledger.ids(line):
                sign = Decimal(-1) if line == Line.REVENUE else Decimal(1)
                a = sign * ledger.moved(account_id, m, m)
                b = sign * ledger.moved(account_id, prev_p, prev_p)
                if a or b:
                    moves.append((abs(a - b), ledger.accounts[account_id].name, kind, a, b))
        floor = max(Decimal(500), abs(now["revenue"]) * Decimal("0.02"))
        moves = sorted((x for x in moves if x[0] >= floor), key=lambda x: -x[0])[:4]
        for index, (_, name, kind, a, b) in enumerate(moves, start=1):
            pack.add(
                "performance",
                f"mover{index}",
                f"{name} ({kind}): {'up' if a > b else 'down'} on the previous month",
                eur(to_cents(abs(a - b))),
                "Largest movements by account",
            )
            pack.add("performance", f"mover{index}Now", f"{name} in {month}", eur(to_cents(a)), "Account total for the month")

    # ---------- cash and working capital ----------
    cash = ledger.line_balance(Line.CASH, m)
    pack.add("cash", "cash", f"Cash at bank at the end of {month}", eur(to_cents(cash)), "Bank accounts")
    if periods:
        flow = cash_flow_lines(ledger, m, m)
        net_change = flow["closing_cash"] - flow["opening_cash"]
        pack.add(
            "cash",
            "cashChange",
            "Cash " + ("increase" if net_change >= 0 else "decrease") + " in the month",
            eur(abs(to_cents(net_change))),
            "Closing less opening cash",
        )
        ops = flow["operations"]
        pack.add(
            "cash",
            "cashFromTrading",
            "Cash " + ("generated" if ops >= 0 else "used") + " by trading, after working capital",
            eur(abs(to_cents(ops))),
            "Cash flow statement",
        )
        if to_cents(flow["debtors"]):
            pack.add(
                "cash",
                "debtorsCash",
                "Cash " + ("released from" if flow["debtors"] > 0 else "tied up in") + " trade debtors in the month",
                eur(abs(to_cents(flow["debtors"]))),
                "Change in trade debtors",
            )
        if to_cents(flow["fixed_assets"]):
            pack.add(
                "cash",
                "capex",
                "Spent on equipment and other fixed assets" if flow["fixed_assets"] < 0 else "Received from selling fixed assets",
                eur(abs(to_cents(flow["fixed_assets"]))),
                "Cash flow statement",
            )
        if to_cents(flow["financing"]):
            pack.add(
                "cash",
                "financing",
                "Net cash "
                + ("from" if flow["financing"] > 0 else "paid to")
                + " lenders and shareholders (loans, dividends, equity)",
                eur(abs(to_cents(flow["financing"]))),
                "Cash flow statement",
            )
    if has(period_add(m, -3)):
        burn = (cash - ledger.line_balance(Line.CASH, period_add(m, -3))) / 3
        pack.add(
            "cash",
            "cashTrend",
            "Average monthly cash " + ("increase" if burn >= 0 else "decrease") + ", last three months",
            eur(abs(to_cents(burn))),
            "Bank balance, three-month change",
        )

    debtors = ledger.line_balance(Line.DEBTORS, m)
    creditors = -ledger.line_balance(Line.CREDITORS, m)
    pack.add("cash", "debtors", "Owed by customers (trade debtors)", eur(to_cents(debtors)), "Balance sheet")
    pack.add("cash", "creditors", "Owed to suppliers (trade creditors)", eur(to_cents(creditors)), "Balance sheet")
    last3 = (period_add(m, -2), m)
    revenue3 = ledger.pnl(Line.REVENUE, *last3)
    if revenue3 > 0 and has(last3[0]):
        days = int(round(debtors / revenue3 * 91))
        pack.add(
            "cash",
            "debtorDays",
            "Debtor days (how long customers take to pay)",
            f"{days} days",
            "Debtors ÷ last three months' revenue",
        )
        if has(period_add(m, -5)):
            before3 = (period_add(m, -5), period_add(m, -3))
            r_before = ledger.pnl(Line.REVENUE, *before3)
            if r_before > 0:
                days_before = int(round(ledger.line_balance(Line.DEBTORS, before3[1]) / r_before * 91))
                pack.add(
                    "cash",
                    "debtorDaysBefore",
                    f"Debtor days three months earlier, at the end of {month_name(before3[1])}",
                    f"{days_before} days",
                    "Debtors ÷ revenue",
                )
                if days > days_before + 7:
                    signals.append({"level": "amber", "text": "Customers are taking longer to pay"})
    costs3 = -ledger.pnl(Line.COST_OF_SALES, *last3) - ledger.pnl(Line.OVERHEADS, *last3)
    if costs3 > 0 and has(last3[0]):
        pack.add(
            "cash",
            "creditorDays",
            "Creditor days (how long we take to pay suppliers)",
            f"{int(round(creditors / costs3 * 91))} days",
            "Creditors ÷ last three months' costs",
        )
    current_assets = sum(
        (ledger.line_balance(line, m) for line in (Line.CASH, Line.DEBTORS, Line.STOCK, Line.OTHER_CURRENT_ASSET)), ZERO
    )
    current_liabilities = -sum(
        (ledger.line_balance(line, m) for line in (Line.CREDITORS, Line.TAX_LIABILITY, Line.OTHER_CURRENT_LIABILITY)), ZERO
    )
    if current_liabilities > 0:
        ratio = current_assets / current_liabilities
        pack.add(
            "cash",
            "currentRatio",
            "Current ratio (short-term assets for each euro of short-term debts)",
            f"{float(ratio):.2f}",
            "Current assets ÷ current liabilities",
        )
        if ratio < 1:
            signals.append({"level": "red", "text": "Short-term debts exceed short-term assets"})
    loan = -ledger.line_balance(Line.LOAN, m)
    if loan > 0:
        pack.add("cash", "loan", "Bank loans outstanding", eur(to_cents(loan)), "Balance sheet")

    ageing = data.ageing or {}
    receivable = ageing.get("receivable") or []
    if receivable:
        overdue = sum(b["value"] for b in receivable[1:])
        over60 = sum(b["value"] for b in receivable[3:])
        pack.add(
            "cash",
            "overdue",
            "Customer invoices past their due date",
            eur(overdue),
            f"Xero, unpaid invoices at {ageing.get('asOf', 'the last sync')}",
        )
        pack.add("cash", "overdue60", "Customer invoices more than sixty days overdue", eur(over60), "Xero, unpaid invoices")
        total = sum(b["value"] for b in receivable)
        if total and over60 > total * 0.15:
            signals.append({"level": "amber", "text": "A large share of what customers owe is more than sixty days overdue"})
        top = (ageing.get("receivableTop") or [])[:3]
        for index, row in enumerate(top, start=1):
            pack.add(
                "cash",
                f"owes{index}",
                f"Customer owing the {['most', 'second most', 'third most'][index - 1]}",
                f"{row['contact']}, {eur(row['value'])}",
                "Xero, unpaid invoices",
            )
    payable = ageing.get("payable") or []
    if payable:
        pack.add(
            "cash",
            "billsOverdue",
            "Supplier bills past their due date",
            eur(sum(b["value"] for b in payable[1:])),
            "Xero, unpaid bills",
        )

    # ---------- customers ----------
    customers = data.customers or {}
    month_sales = sorted(customers.get("month") or [], key=lambda r: -r["value"])
    quarter_sales = sorted(customers.get("quarter") or [], key=lambda r: -r["value"])
    if month_sales:
        total = sum(r["value"] for r in month_sales)
        pack.add("performance", "customersCount", "Customers invoiced this month", str(len(month_sales)), "Sales by customer")
        for index, row in enumerate(month_sales[:3], start=1):
            share = f" ({pct(row['value'] / total, 0)} of sales)" if total > 0 else ""
            pack.add(
                "performance",
                f"customer{index}",
                f"Customer number {index} by sales this month",
                f"{row['contact']}, {eur(row['value'])}{share}",
                "Sales by customer",
            )
        prior = set(customers.get("prior") or [])
        if prior:
            new = [r["contact"] for r in month_sales if r["contact"] not in prior]
            if new:
                pack.add(
                    "performance",
                    "newCustomers",
                    "New customers this month (not invoiced in the previous two months)",
                    ", ".join(new[:4]),
                    "Sales by customer",
                )
    if quarter_sales:
        total = sum(r["value"] for r in quarter_sales)
        if total > 0:
            top = quarter_sales[0]
            share = top["value"] / total
            pack.add(
                "risk",
                "topCustomerShare",
                "Largest customer's share of sales over the last three months",
                f"{top['contact']}, {pct(share, 0)}",
                "Sales by customer",
            )
            if share > 0.25:
                signals.append(
                    {
                        "level": "amber" if share < 0.4 else "red",
                        "text": f"Sales depend heavily on one customer, {top['contact']}",
                    }
                )

    # ---------- outlook ----------
    forecast = data.forecast or {}
    if forecast:
        horizon = len(forecast.get("months") or []) or 24
        if forecast.get("cashOutPeriod"):
            pack.add(
                "outlook",
                "cashOut",
                "On the base-case forecast, cash runs out in",
                month_name(forecast["cashOutPeriod"]),
                "Base-case forecast",
            )
            pack.add(
                "outlook",
                "runway",
                "Months of runway on the base case",
                months_text(forecast.get("runwayMonths") or 0),
                "Base-case forecast",
            )
            signals.append(
                {
                    "level": "red" if (forecast.get("runwayMonths") or 0) < 12 else "amber",
                    "text": "The base-case forecast runs out of cash",
                }
            )
        else:
            pack.add(
                "outlook",
                "runway",
                "On the base-case forecast, cash stays positive for the whole forecast of",
                f"{horizon} months",
                "Base-case forecast",
            )
        if forecast.get("lowestCash") is not None and forecast.get("lowestCashPeriod"):
            low = forecast["lowestCash"]
            label = "Lowest forecast bank balance" if low >= 0 else "At its lowest, the forecast bank account is overdrawn by"
            pack.add(
                "outlook",
                "lowestCash",
                label,
                f"{eur(abs(low))} in {month_name(forecast['lowestCashPeriod'])}",
                "Base-case forecast",
            )
        months = forecast.get("months") or []
        if len(months) >= 3:
            pack.add(
                "outlook",
                "forecastRevenue3m",
                "Forecast revenue for the next three months",
                eur(sum(x["revenue"] for x in months[:3])),
                "Base-case forecast",
            )
        if len(months) >= 12:
            ebitda12 = sum(x["ebitda"] for x in months[:12])
            pack.add(
                "outlook",
                "forecastEbitda12m",
                "Forecast EBITDA over the next twelve months"
                if ebitda12 >= 0
                else "Forecast EBITDA loss over the next twelve months",
                eur(abs(ebitda12)),
                "Base-case forecast",
            )
            pack.add(
                "outlook",
                "forecastCash12m",
                f"Forecast cash at bank in {month_name(months[11]['period'])}",
                eur(months[11]["cash"]),
                "Base-case forecast",
            )
        sens = forecast.get("sensitivity") or {}
        rows = [r for r in sens.get("rows") or [] if abs(r.get("low", 0)) >= 0.05 or abs(r.get("high", 0)) >= 0.05]
        if rows:
            top = rows[0]
            pack.add(
                "outlook",
                "topDriver",
                f"The assumption that moves runway most: {top['label']} ({top['range']})",
                f"{top['low']:+.1f} to {top['high']:+.1f} months",
                "Forecast sensitivity",
            )

    for index, scenario in enumerate(data.scenarios[:3], start=1):
        name = scenario.get("name") or f"Scenario {index}"
        what = scenario.get("changes") or "changes to the base case"
        if scenario.get("cashOutPeriod"):
            pack.add(
                "outlook",
                f"scenario{index}",
                f"Scenario “{name}” ({what}): cash runs out in",
                month_name(scenario["cashOutPeriod"]),
                "Scenario forecast",
            )
        else:
            pack.add(
                "outlook",
                f"scenario{index}",
                f"Scenario “{name}” ({what}): cash stays positive throughout; cash in twelve months",
                eur(scenario.get("cash12") or 0),
                "Scenario forecast",
            )

    plan = data.plan or {}
    if plan:
        source = f"Base-case forecast made at the end of {month_name(plan['madeAt'])}"
        for key, label in (("revenue", "Revenue"), ("ebitda", "EBITDA"), ("cash", "Cash at bank")):
            if plan.get(key) is None:
                continue
            ours = {"revenue": now["revenue"], "ebitda": now["ebitda"], "cash": cash}[key]
            diff = to_cents(ours) - int(plan[key])
            word = "above" if diff >= 0 else "below"
            pack.add("performance" if key != "cash" else "cash", f"{key}VsPlan", f"{label}: {word} plan", eur(abs(diff)), source)
            pack.add(
                "performance" if key != "cash" else "cash",
                f"{key}Plan",
                f"{label} the plan expected",
                eur(int(plan[key])),
                source,
            )
        if plan.get("revenue") and to_cents(now["revenue"]) < int(plan["revenue"]) * 0.95:
            signals.append({"level": "amber", "text": "Revenue came in below plan"})

    # ---------- data ----------
    recon = data.reconciliation or {}
    if recon.get("status"):
        if recon["status"] == "match":
            pack.add("data", "reconciled", "These figures were checked against Xero's own reports", "match", "Reconciliation")
        else:
            pack.add(
                "data",
                "reconciled",
                "Lines that differ from Xero's own reports",
                str(len(recon.get("differences") or [])),
                "Reconciliation",
            )
            signals.append({"level": "amber", "text": "Some figures differ from Xero and need review"})
    if not signals:
        signals.append({"level": "green", "text": "No warning signs in the figures"})
    return pack.facts, signals
