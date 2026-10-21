"""Build statements, measures and chart data from monthly account movements.

Input is the movement (sum of journal net amounts, debit positive) for every account and month.
Presentation signs follow the paper conventions Ledgerline uses everywhere:

* P&L: income positive, costs negative (presented = -net).
* Balance sheet: assets positive, liabilities negative (presented = net), equity positive (presented = -net).

Every statement is checked before it is returned: the balance sheet balances, the cash flow closes to the
bank balance, and the P&L total equals the movement in retained earnings.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal

from ..money import ZERO, from_cents, round_money, to_cents
from .classify import (
    ASSET_LINES,
    LIABILITY_LINES,
    PNL_LINES,
    AccountInfo,
    Line,
    classify,
)

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


class StatementError(AssertionError):
    """A statement failed its own integrity check. Never shown to a user as if it were right."""


def period_add(period: str, months: int) -> str:
    year, month = int(period[:4]), int(period[5:7])
    index = year * 12 + (month - 1) + months
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def period_range(start: str, end: str) -> list[str]:
    out, current = [], start
    while current <= end:
        out.append(current)
        current = period_add(current, 1)
    return out


def period_label(period: str, with_year: bool = True) -> str:
    name = MONTH_NAMES[int(period[5:7]) - 1]
    return f"{name} {period[2:4]}" if with_year else name


def fy_start(period: str, fy_start_month: int) -> str:
    year, month = int(period[:4]), int(period[5:7])
    start_year = year if month >= fy_start_month else year - 1
    return f"{start_year:04d}-{fy_start_month:02d}"


@dataclass
class Ledger:
    """Monthly movements, with helpers for sums and balances."""

    accounts: dict[str, AccountInfo]
    movements: dict[str, dict[str, Decimal]] = field(default_factory=dict)  # account -> period -> Decimal

    @classmethod
    def from_payload(cls, accounts: list[dict], balances: list[dict]) -> Ledger:
        infos = {a["xero_account_id"]: classify(a) for a in accounts}
        movements: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(lambda: ZERO))
        for row in balances:
            account_id = row["xero_account_id"]
            if account_id not in infos:
                infos[account_id] = classify({"xero_account_id": account_id, "name": "Unknown account", "type": ""})
            movements[account_id][row["period"]] += from_cents(int(row["net_cents"]))
        return cls(accounts=infos, movements=movements)

    def periods(self) -> list[str]:
        found = {p for by_period in self.movements.values() for p in by_period}
        return sorted(found)

    def moved(self, account_id: str, start: str, end: str) -> Decimal:
        return sum((v for p, v in self.movements.get(account_id, {}).items() if start <= p <= end), ZERO)

    def balance(self, account_id: str, end: str) -> Decimal:
        return sum((v for p, v in self.movements.get(account_id, {}).items() if p <= end), ZERO)

    def ids(self, *lines: Line) -> list[str]:
        wanted = set(lines)
        return sorted(
            (a.id for a in self.accounts.values() if a.line in wanted),
            key=lambda i: (self.accounts[i].code or "~", self.accounts[i].name),
        )

    def line_moved(self, line: Line, start: str, end: str) -> Decimal:
        return sum((self.moved(i, start, end) for i in self.ids(line)), ZERO)

    def line_balance(self, line: Line, end: str) -> Decimal:
        return sum((self.balance(i, end) for i in self.ids(line)), ZERO)

    # Presented P&L amounts: income positive, costs negative.
    def pnl(self, line: Line, start: str, end: str) -> Decimal:
        return -self.line_moved(line, start, end)

    def net_profit(self, start: str, end: str) -> Decimal:
        return sum((self.pnl(line, start, end) for line in PNL_LINES), ZERO)


def _cents(values: list[Decimal | None]) -> list[int | None]:
    return [None if v is None else to_cents(v) for v in values]


def _row(kind: str, label: str, values: list[Decimal | None], code: str = "", account_id: str = "") -> dict:
    row = {"type": kind, "label": label, "values": _cents(values)}
    if code:
        row["code"] = code
    if account_id:
        row["accountId"] = account_id
    return row


def build_pnl(ledger: Ledger, months: list[str], actual_to: str) -> dict:
    """Monthly P&L for the financial year, plus a year-to-date total. Future months are null."""

    def series(fn):
        values = [fn(m, m) if m <= actual_to else None for m in months]
        total = fn(months[0], min(actual_to, months[-1]))
        return values + [total]

    rows: list[dict] = []

    def account_rows(line: Line) -> None:
        for account_id in ledger.ids(line):
            info = ledger.accounts[account_id]
            values = series(lambda a, b, i=account_id: -ledger.moved(i, a, b))
            if all(v is None or v == 0 for v in values):
                continue
            rows.append(_row("line", info.name, values, info.code, account_id))

    rows.append({"type": "section", "label": "Trading income"})
    account_rows(Line.REVENUE)
    account_rows(Line.COST_OF_SALES)
    gross = series(lambda a, b: ledger.pnl(Line.REVENUE, a, b) + ledger.pnl(Line.COST_OF_SALES, a, b))
    rows.append(_row("subtotal", "Gross profit", gross))
    rows.append({"type": "section", "label": "Operating expenses"})
    account_rows(Line.OVERHEADS)
    overheads = series(lambda a, b: ledger.pnl(Line.OVERHEADS, a, b))
    rows.append(_row("subtotal", "Total operating expenses", overheads))
    ebitda = [None if g is None else g + o for g, o in zip(gross, overheads, strict=True)]
    rows.append(_row("subtotal", "EBITDA", ebitda))
    account_rows(Line.DEPRECIATION)
    account_rows(Line.INTEREST)
    account_rows(Line.TAX)
    net = series(ledger.net_profit)
    rows.append(_row("total", "Net profit", net))

    columns = [{"label": period_label(m), "period": m, "kind": "A" if m <= actual_to else "F"} for m in months]
    columns.append({"label": f"FY {months[-1][:4]}", "kind": "YTD"})
    return {"columns": columns, "rows": rows}


def _equity_parts(ledger: Ledger, end: str, fy_first: str) -> tuple[Decimal, Decimal, Decimal]:
    """Equity accounts, retained earnings from prior years and current-year earnings, presented positive."""
    accounts = -ledger.line_balance(Line.EQUITY, end)
    first = ledger.periods()[0] if ledger.periods() else fy_first
    prior = ledger.net_profit(first, period_add(fy_first, -1)) if first < fy_first else ZERO
    current = ledger.net_profit(fy_first, end)
    return accounts, prior, current


def build_balance_sheet(ledger: Ledger, dates: list[str], fy_start_month: int) -> dict:
    rows: list[dict] = []

    def account_rows(lines: set[Line] | tuple[Line, ...], sign: int) -> None:
        for account_id in ledger.ids(*lines):
            info = ledger.accounts[account_id]
            values = [sign * ledger.balance(account_id, d) for d in dates]
            if all(v == 0 for v in values):
                continue
            rows.append(_row("line", info.name, values, info.code, account_id))

    rows.append({"type": "section", "label": "Assets"})
    account_rows((Line.FIXED_ASSET, Line.CASH, Line.DEBTORS, Line.STOCK, Line.OTHER_CURRENT_ASSET), 1)
    assets = [sum((ledger.line_balance(line, d) for line in ASSET_LINES), ZERO) for d in dates]
    rows.append(_row("subtotal", "Total assets", assets))
    rows.append({"type": "section", "label": "Liabilities"})
    account_rows((Line.CREDITORS, Line.TAX_LIABILITY, Line.OTHER_CURRENT_LIABILITY, Line.LOAN), 1)
    liabilities = [sum((ledger.line_balance(line, d) for line in LIABILITY_LINES), ZERO) for d in dates]
    rows.append(_row("subtotal", "Total liabilities", liabilities))
    net_assets = [a + li for a, li in zip(assets, liabilities, strict=True)]
    rows.append(_row("total", "Net assets", net_assets))

    rows.append({"type": "section", "label": "Equity"})
    for account_id in ledger.ids(Line.EQUITY):
        info = ledger.accounts[account_id]
        values = [-ledger.balance(account_id, d) for d in dates]
        if any(v != 0 for v in values):
            rows.append(_row("line", info.name, values, info.code, account_id))
    parts = [_equity_parts(ledger, d, fy_start(d, fy_start_month)) for d in dates]
    rows.append(_row("line", "Retained earnings from prior years", [p[1] for p in parts]))
    rows.append(_row("line", "Current year earnings", [p[2] for p in parts]))
    equity = [sum(p, ZERO) for p in parts]
    rows.append(_row("total", "Total equity", equity))

    for d, na, eq in zip(dates, net_assets, equity, strict=True):
        if abs(na - eq) > Decimal("0.005"):
            raise StatementError(f"balance sheet at {d} is out by {na - eq}")
    return {"rows": rows, "netAssets": _cents(net_assets), "totalAssets": _cents(assets)}


def cash_flow_lines(ledger: Ledger, start: str, end: str) -> dict[str, Decimal]:
    """Indirect-method cash flow over [start, end]."""

    def change(*lines: Line) -> Decimal:
        # Cash effect of a non-cash balance-sheet line is minus its movement.
        return -sum((ledger.line_moved(line, start, end) for line in lines), ZERO)

    depreciation = -ledger.pnl(Line.DEPRECIATION, start, end)
    out = {
        "net_profit": ledger.net_profit(start, end),
        "depreciation": depreciation,
        "debtors": change(Line.DEBTORS),
        "stock": change(Line.STOCK),
        "creditors": change(Line.CREDITORS),
        "tax": change(Line.TAX_LIABILITY),
        "other_working_capital": change(Line.OTHER_CURRENT_ASSET, Line.OTHER_CURRENT_LIABILITY),
        "fixed_assets": change(Line.FIXED_ASSET) - depreciation,
        "loans": change(Line.LOAN),
        "equity": change(Line.EQUITY),
    }
    out["operations"] = (
        out["net_profit"]
        + depreciation
        + out["debtors"]
        + out["stock"]
        + out["creditors"]
        + out["tax"]
        + out["other_working_capital"]
    )
    out["investing"] = out["fixed_assets"]
    out["financing"] = out["loans"] + out["equity"]
    out["net_change"] = out["operations"] + out["investing"] + out["financing"]
    out["opening_cash"] = ledger.line_balance(Line.CASH, period_add(start, -1))
    out["closing_cash"] = ledger.line_balance(Line.CASH, end)
    if abs(out["opening_cash"] + out["net_change"] - out["closing_cash"]) > Decimal("0.005"):
        raise StatementError(f"cash flow {start}..{end} does not close")
    return out


def build_cash_flow(ledger: Ledger, ranges: list[tuple[str, str, str]]) -> dict:
    flows = [cash_flow_lines(ledger, a, b) for _, a, b in ranges]

    def r(kind, label, key):
        return _row(kind, label, [f[key] for f in flows])

    rows = [
        {"type": "section", "label": "Operating activities"},
        r("line", "Net profit", "net_profit"),
        r("line", "Add back depreciation", "depreciation"),
        r("line", "Change in trade debtors", "debtors"),
        r("line", "Change in stock", "stock"),
        r("line", "Change in trade creditors", "creditors"),
        r("line", "Change in tax and VAT owed", "tax"),
        r("line", "Other working capital", "other_working_capital"),
        r("subtotal", "Cash from operations", "operations"),
        {"type": "section", "label": "Investing activities"},
        r("line", "Purchase of fixed assets", "fixed_assets"),
        r("subtotal", "Cash used in investing", "investing"),
        {"type": "section", "label": "Financing activities"},
        r("line", "Loans drawn and repaid", "loans"),
        r("line", "Equity raised and drawn", "equity"),
        r("subtotal", "Cash from financing", "financing"),
        {"type": "spacer"},
        r("subtotal", "Net change in cash", "net_change"),
        r("line", "Opening cash", "opening_cash"),
        r("total", "Closing cash", "closing_cash"),
    ]
    rows = [row for row in rows if row["type"] != "line" or any(v for v in row["values"])]
    return {"columns": [{"label": label, "kind": "Actual"} for label, _, _ in ranges], "rows": rows}


def build_bridge(ledger: Ledger, month: str) -> list[dict]:
    flow = cash_flow_lines(ledger, month, month)
    steps = [
        {"label": f"Opening cash 1 {MONTH_NAMES[int(month[5:7]) - 1]}", "value": to_cents(flow["opening_cash"]), "kind": "start"}
    ]
    for key, label in [
        ("net_profit", "Net profit"),
        ("depreciation", "Depreciation"),
        ("tax", "Tax not yet paid"),
        ("debtors", "Trade debtors"),
        ("stock", "Stock"),
        ("creditors", "Trade creditors"),
        ("other_working_capital", "Other working capital"),
        ("fixed_assets", "Fixed assets"),
        ("loans", "Loans"),
        ("equity", "Equity"),
    ]:
        if round_money(flow[key]) != 0:
            steps.append({"label": label, "value": to_cents(flow[key])})
    steps.append({"label": "Closing cash", "value": to_cents(flow["closing_cash"]), "kind": "end"})
    return steps


def build_sankey(ledger: Ledger, month: str, top: int = 5) -> dict:
    revenue = ledger.pnl(Line.REVENUE, month, month)
    cogs = -ledger.pnl(Line.COST_OF_SALES, month, month)
    gross = revenue - cogs
    overheads = sorted(
        ((ledger.accounts[i].name, ledger.moved(i, month, month)) for i in ledger.ids(Line.OVERHEADS)),
        key=lambda x: -x[1],
    )
    overheads = [(n, v) for n, v in overheads if v > 0]
    shown, rest = overheads[:top], overheads[top:]
    if rest:
        shown.append(("Other overheads", sum((v for _, v in rest), ZERO)))
    ebitda = gross - sum((v for _, v in overheads), ZERO)
    dep = -ledger.pnl(Line.DEPRECIATION, month, month)
    interest = -ledger.pnl(Line.INTEREST, month, month)
    tax = -ledger.pnl(Line.TAX, month, month)
    net = ledger.net_profit(month, month)
    tones = ["chart-2", "chart-3", "chart-5", "chart-4", "chart-6", "chart-6"]
    nodes = [
        {"id": "rev", "label": "Revenue", "col": 0, "tone": "chart-1"},
        {"id": "gp", "label": "Gross profit", "col": 1, "tone": "chart-1"},
        {"id": "cogs", "label": "Cost of sales", "col": 1, "tone": "chart-6"},
        {"id": "ebitda", "label": "EBITDA", "col": 2, "tone": "chart-1"},
    ]
    links = [
        {"source": "rev", "target": "gp", "value": to_cents(gross)},
        {"source": "rev", "target": "cogs", "value": to_cents(cogs)},
    ]
    if ebitda > 0:
        links.append({"source": "gp", "target": "ebitda", "value": to_cents(ebitda)})
    for index, (name, value) in enumerate(shown):
        node_id = f"oh{index}"
        nodes.append({"id": node_id, "label": name, "col": 2, "tone": tones[index % len(tones)]})
        links.append({"source": "gp", "target": node_id, "value": to_cents(value)})
    if ebitda > 0:
        for node_id, label, value, tone in [
            ("np", "Net profit", net, "chart-1"),
            ("tax", "Corporation tax", tax, "chart-5"),
            ("dep", "Depreciation", dep, "chart-6"),
            ("int", "Interest", interest, "chart-6"),
        ]:
            if value > 0:
                nodes.append({"id": node_id, "label": label, "col": 3, "tone": tone, "emphasis": node_id == "np"})
                links.append({"source": "ebitda", "target": node_id, "value": to_cents(value)})
    links = [link for link in links if link["value"] > 0]
    used = {link["source"] for link in links} | {link["target"] for link in links}
    return {"nodes": [n for n in nodes if n["id"] in used], "links": links}


def _ratio(numerator: Decimal, denominator: Decimal) -> float | None:
    if denominator == 0:
        return None
    return float(round(numerator / denominator, 4))


def build_measures(ledger: Ledger, month: str) -> dict:
    last3 = (period_add(month, -2), month)
    prev = period_add(month, -1)
    revenue = ledger.pnl(Line.REVENUE, month, month)
    revenue_prev = ledger.pnl(Line.REVENUE, prev, prev)
    gross = revenue + ledger.pnl(Line.COST_OF_SALES, month, month)
    ebitda = gross + ledger.pnl(Line.OVERHEADS, month, month)
    net = ledger.net_profit(month, month)
    net_prev = ledger.net_profit(prev, prev)
    revenue3 = ledger.pnl(Line.REVENUE, *last3)
    cogs3 = -ledger.pnl(Line.COST_OF_SALES, *last3)
    overheads3 = -ledger.pnl(Line.OVERHEADS, *last3)
    debtors = ledger.line_balance(Line.DEBTORS, month)
    creditors = -ledger.line_balance(Line.CREDITORS, month)
    stock = ledger.line_balance(Line.STOCK, month)
    cash = ledger.line_balance(Line.CASH, month)
    cash_prev = ledger.line_balance(Line.CASH, prev)
    current_assets = sum(
        (ledger.line_balance(line, month) for line in (Line.CASH, Line.DEBTORS, Line.STOCK, Line.OTHER_CURRENT_ASSET)), ZERO
    )
    current_liabilities = -sum(
        (ledger.line_balance(line, month) for line in (Line.CREDITORS, Line.TAX_LIABILITY, Line.OTHER_CURRENT_LIABILITY)), ZERO
    )
    changes = [
        ledger.line_balance(Line.CASH, period_add(month, -k)) - ledger.line_balance(Line.CASH, period_add(month, -k - 1))
        for k in range(3)
    ]
    burn = sum(changes, ZERO) / 3
    runway = float(round(cash / -burn, 1)) if burn < 0 and cash > 0 else None
    return {
        "month": month,
        "revenue": to_cents(revenue),
        "revenueDelta": _ratio(revenue - revenue_prev, abs(revenue_prev)),
        "grossProfit": to_cents(gross),
        "grossMargin": _ratio(gross, revenue),
        "ebitda": to_cents(ebitda),
        "netProfit": to_cents(net),
        "netProfitDelta": _ratio(net - net_prev, abs(net_prev)),
        "cash": to_cents(cash),
        "cashDelta": _ratio(cash - cash_prev, abs(cash_prev)),
        "debtors": to_cents(debtors),
        "creditors": to_cents(creditors),
        "debtorDays": None if revenue3 == 0 else int(round(debtors / revenue3 * 91)),
        "creditorDays": None if cogs3 + overheads3 == 0 else int(round(creditors / (cogs3 + overheads3) * 91)),
        "stockDays": None if cogs3 == 0 else int(round(stock / cogs3 * 91)),
        "currentRatio": _ratio(current_assets, current_liabilities),
        "burn": to_cents(burn),
        "runwayMonths": runway,
    }


def build_series(ledger: Ledger, months: list[str]) -> dict:
    def per_month(fn):
        return [to_cents(fn(m)) for m in months]

    return {
        "periods": months,
        "labels": [period_label(m) for m in months],
        "revenue": per_month(lambda m: ledger.pnl(Line.REVENUE, m, m)),
        "grossProfit": per_month(lambda m: ledger.pnl(Line.REVENUE, m, m) + ledger.pnl(Line.COST_OF_SALES, m, m)),
        "ebitda": per_month(
            lambda m: ledger.pnl(Line.REVENUE, m, m) + ledger.pnl(Line.COST_OF_SALES, m, m) + ledger.pnl(Line.OVERHEADS, m, m)
        ),
        "netProfit": per_month(lambda m: ledger.net_profit(m, m)),
        "cash": per_month(lambda m: ledger.line_balance(Line.CASH, m)),
        "overheads": per_month(lambda m: -ledger.pnl(Line.OVERHEADS, m, m)),
    }


def build_opex_breakdown(ledger: Ledger, start: str, end: str) -> list[dict]:
    items = [
        {"label": ledger.accounts[i].name, "value": to_cents(ledger.moved(i, start, end))} for i in ledger.ids(Line.OVERHEADS)
    ]
    items = [i for i in items if i["value"] > 0]
    items.sort(key=lambda i: -i["value"])
    if len(items) > 6:
        rest = sum(i["value"] for i in items[5:])
        items = items[:5] + [{"label": "Other", "value": rest}]
    for index, item in enumerate(items):
        item["swatch"] = [2, 3, 5, 4, 6, 1][index % 6]
    return items


def build_drivers(ledger: Ledger, month: str) -> dict:
    """Forecast defaults and opening balances, all derived from actuals."""
    prev3 = (period_add(month, -5), period_add(month, -3))
    last3 = (period_add(month, -2), month)
    revenue3 = ledger.pnl(Line.REVENUE, *last3)
    revenue_prev3 = ledger.pnl(Line.REVENUE, *prev3)
    growth = Decimal("0")
    if revenue_prev3 > 0 and revenue3 > 0:
        growth = Decimal(float(revenue3 / revenue_prev3) ** (1 / 3) - 1).quantize(Decimal("0.0001"))
    growth = min(max(growth, Decimal("-0.05")), Decimal("0.10"))
    gross3 = revenue3 + ledger.pnl(Line.COST_OF_SALES, *last3)
    margin = (gross3 / revenue3).quantize(Decimal("0.0001")) if revenue3 > 0 else Decimal("0.4")
    wages3 = sum((ledger.moved(i, *last3) for i in ledger.ids(Line.OVERHEADS) if ledger.accounts[i].is_wages), ZERO)
    overheads3 = -ledger.pnl(Line.OVERHEADS, *last3)
    measures = build_measures(ledger, month)
    loan = -ledger.line_balance(Line.LOAN, month)
    interest3 = -ledger.pnl(Line.INTEREST, *last3)
    return {
        "startPeriod": period_add(month, 1),
        "revenueLastMonth": to_cents(ledger.pnl(Line.REVENUE, month, month)),
        "growth": float(growth),
        "grossMargin": float(margin),
        "overheadsMonthly": to_cents(overheads3 / 3),
        "wagesMonthly": to_cents(wages3 / 3),
        "overheadGrowth": 0.04,
        "depreciationMonthly": to_cents(-ledger.pnl(Line.DEPRECIATION, *last3) / 3),
        "interestRate": float(round(interest3 * 4 / loan, 4)) if loan > 0 else 0.0,
        # Repayments debit the loan, so a positive movement is money paid back.
        "loanRepaymentMonthly": to_cents(max(ZERO, ledger.line_moved(Line.LOAN, *last3) / 3)),
        "taxRate": 0.125,
        "debtorDays": measures["debtorDays"] or 30,
        "creditorDays": measures["creditorDays"] or 30,
        "stockDays": measures["stockDays"] or 0,
        "opening": {
            "cash": to_cents(ledger.line_balance(Line.CASH, month)),
            "debtors": to_cents(ledger.line_balance(Line.DEBTORS, month)),
            "stock": to_cents(ledger.line_balance(Line.STOCK, month)),
            "otherCurrentAssets": to_cents(ledger.line_balance(Line.OTHER_CURRENT_ASSET, month)),
            "fixedAssets": to_cents(ledger.line_balance(Line.FIXED_ASSET, month)),
            "creditors": to_cents(-ledger.line_balance(Line.CREDITORS, month)),
            "taxPayable": to_cents(-ledger.line_balance(Line.TAX_LIABILITY, month)),
            "otherCurrentLiabilities": to_cents(-ledger.line_balance(Line.OTHER_CURRENT_LIABILITY, month)),
            "loan": to_cents(loan),
        },
    }


def build_all(accounts: list[dict], balances: list[dict], fy_start_month: int, as_of: str) -> dict:
    ledger = Ledger.from_payload(accounts, balances)
    first = fy_start(as_of, fy_start_month)
    months = period_range(first, period_add(first, 11))
    prior_year_end = period_add(first, -1)
    history = period_range(period_add(as_of, -23), as_of)
    return {
        "asOf": as_of,
        "fyStart": first,
        "pnl": build_pnl(ledger, months, as_of),
        "balance": {
            "columns": [
                {"label": f"{period_label(prior_year_end)} close", "kind": "Closing"},
                {"label": period_label(as_of), "kind": "Actual"},
            ],
            **build_balance_sheet(ledger, [prior_year_end, as_of], fy_start_month),
        },
        "cashflow": build_cash_flow(
            ledger, [(period_label(as_of), as_of, as_of), (f"{period_label(first, False)}–{period_label(as_of)}", first, as_of)]
        ),
        "bridge": build_bridge(ledger, as_of),
        "sankey": build_sankey(ledger, as_of),
        "measures": build_measures(ledger, as_of),
        "series": build_series(ledger, history),
        "opexYtd": build_opex_breakdown(ledger, first, as_of),
        "drivers": build_drivers(ledger, as_of),
    }
