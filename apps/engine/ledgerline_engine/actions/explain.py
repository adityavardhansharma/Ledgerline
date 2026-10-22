"""Explaining actions: the engine computes the facts, the model words them, citing each figure by id."""

from __future__ import annotations

import statistics
from datetime import date
from decimal import Decimal

import httpx
from pydantic import BaseModel, Field

from ..commentary.facts import Fact, Pack, eur, month_name, pct
from ..money import to_cents
from ..settings import Settings
from ..statements.build import Ledger, period_add
from ..statements.classify import Line
from .common import PROSE_RULES, SEGMENTS, ActionInvalid, cited, facts_message, run


def _paragraphs(max_items: int) -> dict:
    return {"type": "array", "maxItems": max_items, "items": SEGMENTS}


def _prose(payload: dict, key: str, facts: list[Fact], limit: int) -> list[list]:
    out = [cited(p, facts, key, limit) for p in payload.get(key) or []]
    out = [p for p in out if p]
    if not out:
        raise ActionInvalid(f"{key} is empty")
    return out


def _day(iso: str) -> str:
    d = date.fromisoformat(iso[:10])
    return f"{d.day} {month_name(iso[:7]).split()[0][:3]} {d.year}"


# ---------- why did this figure move ----------


class FigureLine(BaseModel):
    date: str
    description: str = ""
    contact: str = ""
    reference: str = ""
    source: str = ""
    cents: int  # in the statement's sign: positive adds to the figure


class ExplainFigureRequest(BaseModel):
    account: str
    kind: str = "cost"  # income, cost, asset, liability, equity
    period: str
    value_cents: int
    previous_cents: int | None = None
    last_year_cents: int | None = None
    lines: list[FigureLine] = Field(default_factory=list, max_length=400)
    other_cents: int = 0


def explain_figure(body: ExplainFigureRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    pack = Pack()
    month = month_name(body.period)
    now = Decimal(body.value_cents) / 100
    pack.add("figure", "value", f"{body.account} in {month}", eur(body.value_cents), "Statement")
    if body.previous_cents is not None:
        before = Decimal(body.previous_cents) / 100
        pack.add(
            "figure",
            "previous",
            f"{body.account} in {month_name(period_add(body.period, -1))}",
            eur(body.previous_cents),
            "Statement",
        )
        pack.change("figure", "vsPrevious", body.account, now, before, "the previous month", "Statement")
    if body.last_year_cents is not None:
        ly = Decimal(body.last_year_cents) / 100
        pack.change("figure", "vsLastYear", body.account, now, ly, month_name(period_add(body.period, -12)), "Statement")
    lines = sorted(body.lines, key=lambda line: -abs(line.cents))
    pack.add("figure", "lineCount", "Transactions behind the figure", str(len(body.lines)), "Ledger")
    for index, line in enumerate(lines[:6], start=1):
        what = " · ".join(x for x in (line.description or line.source, line.contact) if x) or "A posting"
        effect = "adds" if line.cents >= 0 else "takes off"
        pack.add(
            "lines", f"line{index}", f"{what}, {_day(line.date)} ({effect})", eur(abs(line.cents)), line.reference or "Ledger"
        )
    if len(lines) > 6:
        rest = sum(line.cents for line in lines[6:])
        pack.add("lines", "rest", f"The other {len(lines) - 6} transactions together", eur(abs(rest)), "Ledger")
    if body.other_cents:
        pack.add(
            "lines",
            "other",
            "Posted outside invoices, bills and bank items (payroll, depreciation, transfers)",
            eur(abs(body.other_cents)),
            "Xero",
        )
    facts = pack.facts
    task = (
        f"In two to four sentences, explain why {body.account} is what it is in {month}. Say how it compares with "
        "the previous month or last year where facts exist, then name the one to three transactions that account "
        "for most of it. One paragraph, or two if needed."
    )
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["paragraphs"],
        "properties": {"paragraphs": _paragraphs(2)},
    }
    paragraphs = run(
        settings,
        PROSE_RULES,
        facts_message(facts) + "\n\n" + task,
        schema,
        lambda p: _prose(p, "paragraphs", facts, 4),
        http=http,
    )
    return {"paragraphs": paragraphs, "facts": [f.model_dump() for f in facts]}


# ---------- why does cash dip ----------


class CashDipRequest(BaseModel):
    months: list[dict] = Field(min_length=1, max_length=36)
    opening_cash: int
    cash_out_period: str | None = None
    lowest_period: str | None = None
    drivers: dict = Field(default_factory=dict)
    hires: list[dict] = []
    one_offs: list[dict] = []
    financing: list[dict] = []


FIX_AREAS = ["financing", "hires", "oneoffs", "assumptions"]


def cash_dip(body: CashDipRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    target = body.cash_out_period or body.lowest_period or body.months[-1]["period"]
    window = [m for m in body.months if m["period"] <= target] or body.months[:1]
    pack = Pack()
    pack.add("cash", "opening", "Cash at bank today", eur(body.opening_cash), "Balance sheet")
    end = window[-1]
    label = "Cash runs out in" if body.cash_out_period else "Cash is lowest in"
    pack.add("cash", "when", label, month_name(target), "Forecast")
    pack.add("cash", "low", f"Forecast cash at the end of {month_name(end['period'])}", eur(end["cash"]), "Forecast")
    operating = sum(m.get("operating", 0) for m in window)
    investing = sum(m.get("investing", 0) for m in window)
    financing = sum(m.get("financing", 0) for m in window)
    pack.add(
        "cash",
        "operating",
        "Cash " + ("generated" if operating >= 0 else "used") + " by trading until then",
        eur(abs(operating)),
        "Forecast cash flow",
    )
    if investing:
        pack.add("cash", "investing", "Spent on equipment until then", eur(abs(investing)), "Forecast cash flow")
    if financing:
        pack.add(
            "cash",
            "financing",
            "Net " + ("received from" if financing > 0 else "paid to") + " lenders and shareholders until then",
            eur(abs(financing)),
            "Forecast cash flow",
        )
    hires = sum(m.get("hires", 0) for m in window)
    if hires:
        pack.add("cash", "hires", "Cost of new hires until then", eur(abs(hires)), "Forecast")
    worst = min(window, key=lambda m: m["cash"] - (window[window.index(m) - 1]["cash"] if window.index(m) else body.opening_cash))
    worst_index = window.index(worst)
    drop = worst["cash"] - (window[worst_index - 1]["cash"] if worst_index else body.opening_cash)
    if drop < 0:
        pack.add(
            "cash", "worstMonth", f"Biggest monthly fall in cash, in {month_name(worst['period'])}", eur(abs(drop)), "Forecast"
        )
    for index, item in enumerate([o for o in body.one_offs if o.get("period", "") <= target][:3], start=1):
        pack.add(
            "plans",
            f"oneOff{index}",
            f"Planned one-off: {item.get('label', 'item')} ({item.get('kind')}) in {month_name(item['period'])}",
            eur(item.get("amountCents", 0)),
            "Scenario",
        )
    for index, item in enumerate([f for f in body.financing if f.get("period", "") <= target][:3], start=1):
        pack.add(
            "plans",
            f"funding{index}",
            f"Planned {item.get('kind')} in {month_name(item['period'])}",
            eur(item.get("amountCents", 0)),
            "Scenario",
        )
    for key, label in (("debtorDays", "Debtor days assumed"), ("creditorDays", "Creditor days assumed")):
        if key in body.drivers:
            pack.add("assumptions", key, label, f"{round(body.drivers[key])} days", "Drivers")
    for key, label in (("growth", "Monthly revenue growth assumed"), ("grossMargin", "Gross margin assumed")):
        if key in body.drivers:
            pack.add("assumptions", key, label, pct(body.drivers[key]), "Drivers")
    facts = pack.facts
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["paragraphs", "fixes"],
        "properties": {
            "paragraphs": _paragraphs(2),
            "fixes": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["area", "text"],
                    "properties": {"area": {"type": "string", "enum": FIX_AREAS}, "text": SEGMENTS},
                },
            },
        },
    }
    task = (
        f"Explain in two or three sentences why cash falls to its low point ({month_name(target)}): what drains it and "
        "the month that hurts most. Then give up to three practical fixes, each one sentence, tagged with the area of "
        "the plan it changes (financing, hires, oneoffs or assumptions)."
    )

    def validate(payload: dict) -> dict:
        fixes = []
        for fix in payload.get("fixes") or []:
            if fix.get("area") not in FIX_AREAS:
                raise ActionInvalid("unknown fix area")
            fixes.append({"area": fix["area"], "text": cited(fix.get("text") or [], facts, "a fix", 2)})
        return {"paragraphs": _prose(payload, "paragraphs", facts, 4), "fixes": fixes}

    out = run(settings, PROSE_RULES, facts_message(facts) + "\n\n" + task, schema, validate, http=http)
    return {**out, "facts": [f.model_dump() for f in facts]}


# ---------- why does this differ from Xero ----------


class MismatchRequest(BaseModel):
    differences: list[dict] = Field(min_length=1, max_length=50)
    last_sync: str | None = None
    mode: str = "journals"


FIXES = ["sync", "review_in_xero", "check_account", "none"]


def mismatch(body: MismatchRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    pack = Pack()
    shown = sorted(body.differences, key=lambda d: -abs(d.get("diffCents", 0)))[:5]
    for index, d in enumerate(shown, start=1):
        where = f"{d.get('name', 'Account')}, {month_name(d['period'])}"
        pack.add("differences", f"d{index}Ours", f"Ledgerline's figure for {where}", eur(d.get("oursCents", 0)), "Ledgerline")
        pack.add("differences", f"d{index}Xero", f"Xero's figure for {where}", eur(d.get("xeroCents", 0)), "Xero report")
        pack.add("differences", f"d{index}Gap", f"Difference on {where}", eur(abs(d.get("diffCents", 0))), "Reconciliation")
    if body.last_sync:
        pack.add("context", "lastSync", "Last sync finished", _day(body.last_sync), "Sync history")
    facts = pack.facts
    mode = "monthly trial balances" if body.mode == "reports" else "every journal"
    task = (
        f"Ledgerline rebuilds statements from Xero's {mode} and compares them with Xero's own reports. Explain each "
        "difference in one sentence and pick the fix: sync (posted or edited in Xero after the last sync), "
        "review_in_xero (something in Xero needs a person's check, such as a backdated or locked-period change), "
        "check_account (an account type or system account maps it to a different line) or none. Number items by "
        "their position in the facts (d1 is line 1). Then one sentence summing up."
    )
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "items"],
        "properties": {
            "summary": SEGMENTS,
            "items": {
                "type": "array",
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["line", "reason", "fix"],
                    "properties": {"line": {"type": "integer"}, "reason": SEGMENTS, "fix": {"type": "string", "enum": FIXES}},
                },
            },
        },
    }

    def validate(payload: dict) -> dict:
        items = []
        for item in payload.get("items") or []:
            line = int(item.get("line", 0))
            if not 1 <= line <= len(shown) or item.get("fix") not in FIXES:
                raise ActionInvalid("each item needs a line number from the facts and a known fix")
            d = shown[line - 1]
            items.append(
                {
                    "accountId": d.get("accountId", ""),
                    "name": d.get("name", ""),
                    "period": d["period"],
                    "reason": cited(item["reason"], facts, "a reason", 3),
                    "fix": item["fix"],
                }
            )
        return {"summary": cited(payload.get("summary") or [], facts, "the summary", 3), "items": items}

    out = run(settings, PROSE_RULES, facts_message(facts) + "\n\n" + task, schema, validate, http=http)
    return {**out, "facts": [f.model_dump() for f in facts]}


# ---------- what changed since the last sync ----------


class DigestSide(BaseModel):
    as_of: str
    cash: int
    revenue_ytd: int = 0
    net_profit_ytd: int = 0
    rows: list[dict] = []  # {accountId, label, value} year-to-date per account


class DigestRequest(BaseModel):
    before: DigestSide
    after: DigestSide


def digest(body: DigestRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    b, a = body.before, body.after
    before_rows = {r.get("accountId") or r["label"]: r for r in b.rows}
    changes = []
    for row in a.rows:
        key = row.get("accountId") or row["label"]
        old = (before_rows.get(key) or {}).get("value") or 0
        new = row.get("value") or 0
        if new != old:
            changes.append((abs(new - old), row["label"], old, new))
    changes.sort(key=lambda c: -c[0])
    if not changes and a.cash == b.cash and a.as_of == b.as_of:
        return {"items": [], "unchanged": True, "facts": []}
    pack = Pack()
    if a.as_of != b.as_of:
        pack.add("change", "newMonth", "Latest month now in the figures", month_name(a.as_of), "Sync")
    if a.cash != b.cash:
        pack.add(
            "change",
            "cash",
            "Cash at bank " + ("up" if a.cash > b.cash else "down") + " since the last sync",
            eur(abs(a.cash - b.cash)),
            "Bank",
        )
        pack.add("change", "cashNow", "Cash at bank now", eur(a.cash), "Bank")
    if a.revenue_ytd != b.revenue_ytd:
        pack.add(
            "change",
            "revenue",
            "Year-to-date revenue " + ("up" if a.revenue_ytd > b.revenue_ytd else "down") + " since the last sync",
            eur(abs(a.revenue_ytd - b.revenue_ytd)),
            "Profit and loss",
        )
    for index, (_, label, old, new) in enumerate(changes[:4], start=1):
        pack.add(
            "change",
            f"account{index}",
            f"{label}, year to date, " + ("up" if new > old else "down") + " since the last sync",
            eur(abs(new - old)),
            "Profit and loss",
        )
    facts = pack.facts
    schema = {"type": "object", "additionalProperties": False, "required": ["items"], "properties": {"items": _paragraphs(3)}}
    task = "Write up to three very short lines (under twelve words each) saying what changed in the figures since the last sync, most important first."
    items = run(
        settings, PROSE_RULES, facts_message(facts) + "\n\n" + task, schema, lambda p: _prose(p, "items", facts, 2), http=http
    )
    return {"items": items, "unchanged": False, "facts": [f.model_dump() for f in facts]}


# ---------- unusual movements ----------


class AnomalyRequest(BaseModel):
    accounts: list[dict]
    balances: list[dict]
    as_of: str


LINES = ((Line.REVENUE, "income"), (Line.COST_OF_SALES, "direct cost"), (Line.OVERHEADS, "overhead"))


def detect_anomalies(body: AnomalyRequest, limit: int = 6) -> list[dict]:
    """Accounts whose latest month sits far outside their own last twelve months. Pure arithmetic, no model."""
    ledger = Ledger.from_payload(body.accounts, body.balances)
    periods = ledger.periods()
    if not periods:
        return []
    first = periods[0]
    m = body.as_of
    history = [period_add(m, -k) for k in range(1, 13) if period_add(m, -k) > first]
    if len(history) < 6:
        return []
    revenue = abs(ledger.pnl(Line.REVENUE, m, m))
    floor = max(Decimal(500), revenue * Decimal("0.015"))
    out = []
    for line, kind in LINES:
        sign = Decimal(-1) if line == Line.REVENUE else Decimal(1)
        for account_id in ledger.ids(line):
            now = sign * ledger.moved(account_id, m, m)
            past = [sign * ledger.moved(account_id, p, p) for p in history]
            if sum(1 for x in past if x) < 6:
                continue
            typical = Decimal(statistics.median(past))
            spread = Decimal(statistics.median([abs(x - typical) for x in past])) * Decimal("1.4826")
            gap = now - typical
            if abs(gap) < floor:
                continue
            ratio = (now / typical) if typical else None
            unusual = (spread > 0 and abs(gap) / spread > Decimal("3.5")) or (spread == 0 and gap != 0)
            if not unusual or (ratio is not None and Decimal("0.6") < ratio < Decimal("1.6")):
                continue
            out.append(
                {
                    "accountId": account_id,
                    "name": ledger.accounts[account_id].name,
                    "kind": kind,
                    "period": m,
                    "nowCents": to_cents(now),
                    "typicalCents": to_cents(typical),
                    "score": float(abs(gap) / spread) if spread else 99.0,
                }
            )
    out.sort(key=lambda x: -x["score"])
    return out[:limit]


class AnomalyExplainRequest(BaseModel):
    flags: list[dict] = Field(min_length=1, max_length=6)
    lines: dict[str, list[FigureLine]] = {}  # account id -> its largest lines this month


def explain_anomalies(body: AnomalyExplainRequest, settings: Settings, http: httpx.Client | None = None) -> list[dict]:
    pack = Pack()
    for index, flag in enumerate(body.flags, start=1):
        month = month_name(flag["period"])
        pack.add(
            f"flag{index}",
            f"f{index}Now",
            f"{flag['name']} ({flag['kind']}) in {month}",
            eur(flag["nowCents"]),
            "Profit and loss",
        )
        pack.add(
            f"flag{index}",
            f"f{index}Typical",
            f"{flag['name']} in a typical month (median of the last twelve)",
            eur(flag["typicalCents"]),
            "Profit and loss",
        )
        for j, line in enumerate(sorted(body.lines.get(flag["accountId"], []), key=lambda x: -abs(x.cents))[:2], start=1):
            what = " · ".join(x for x in (line.description or line.source, line.contact) if x) or "A posting"
            pack.add(
                f"flag{index}",
                f"f{index}Line{j}",
                f"Largest posting this month: {what}, {_day(line.date)}",
                eur(abs(line.cents)),
                line.reference or "Ledger",
            )
    facts = pack.facts
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["reasons"],
        "properties": {
            "reasons": {
                "type": "array",
                "maxItems": 6,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["flag", "text"],
                    "properties": {"flag": {"type": "integer"}, "text": SEGMENTS},
                },
            }
        },
    }
    task = "For each flagged account (f1, f2, …), write one short sentence saying how far it is from a typical month and, if a posting explains it, which. Number each by its flag."

    def validate(payload: dict) -> list[dict]:
        out = []
        for reason in payload.get("reasons") or []:
            index = int(reason.get("flag", 0))
            if not 1 <= index <= len(body.flags):
                raise ActionInvalid("each reason needs its flag number")
            out.append({"accountId": body.flags[index - 1]["accountId"], "text": cited(reason["text"], facts, "a reason", 3)})
        if len(out) < len(body.flags):
            raise ActionInvalid("give one reason for every flag")
        return out

    return run(settings, PROSE_RULES, facts_message(facts) + "\n\n" + task, schema, validate, http=http)


# ---------- payment reminder ----------


class ReminderRequest(BaseModel):
    company: str
    contact: str
    sender: str = ""
    as_of: str
    items: list[dict] = Field(min_length=1, max_length=50)  # {number, due_date, amount_due_cents}


def reminder(body: ReminderRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    today = date.fromisoformat(body.as_of)
    items = sorted(body.items, key=lambda i: i.get("due_date") or "")
    pack = Pack()
    total = sum(int(i["amount_due_cents"]) for i in items)
    pack.add("owed", "total", f"Total {body.contact} owes", eur(total), "Unpaid invoices")
    pack.add("owed", "count", "Number of unpaid invoices", str(len(items)), "Unpaid invoices")
    overdue = [i for i in items if i.get("due_date") and date.fromisoformat(i["due_date"]) < today]
    if overdue:
        pack.add(
            "owed",
            "overdueTotal",
            "Of which past its due date",
            eur(sum(int(i["amount_due_cents"]) for i in overdue)),
            "Unpaid invoices",
        )
    for index, item in enumerate(items[:6], start=1):
        due = item.get("due_date")
        days = (today - date.fromisoformat(due)).days if due else None
        when = f"{days} days overdue" if days and days > 0 else (f"due {_day(due)}" if due else "no due date")
        pack.add(
            "invoices",
            f"inv{index}",
            f"Invoice {item.get('number') or index}",
            f"{item.get('number') or 'Invoice'}, {eur(int(item['amount_due_cents']))}, {when}",
            "Unpaid invoices",
        )
    facts = pack.facts
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["subject", "body"],
        "properties": {"subject": SEGMENTS, "body": _paragraphs(4)},
    }
    task = (
        f"Draft a short, polite, firm payment reminder email from {body.company}{' (signed ' + body.sender + ')' if body.sender else ''} "
        f"to {body.contact}. Subject line first. In the body: a greeting, the amount and the invoices concerned (cite "
        "them, listing up to three), a clear request to pay or reply with a date, and a sign-off. Warm and brief; no threats."
    )

    def validate(payload: dict) -> dict:
        return {
            "subject": cited(payload.get("subject") or [], facts, "the subject", 1),
            "body": _prose(payload, "body", facts, 4),
        }

    out = run(
        settings,
        PROSE_RULES.replace("inside a finance app for a small business owner", "for a small business owner"),
        facts_message(facts) + "\n\n" + task,
        schema,
        validate,
        http=http,
    )
    return {**out, "facts": [f.model_dump() for f in facts]}


# ---------- a downside case from the company's own history ----------


class DownsideRequest(BaseModel):
    accounts: list[dict]
    balances: list[dict]
    as_of: str
    drivers: dict


def downside_changes(body: DownsideRequest) -> list[dict]:
    """Each driver moved to the worst level the last twelve months actually showed. Pure arithmetic."""
    ledger = Ledger.from_payload(body.accounts, body.balances)
    periods = ledger.periods()
    first = periods[0] if periods else body.as_of
    months = [p for p in (period_add(body.as_of, -k) for k in range(11, -1, -1)) if p > first]
    revenue = [ledger.pnl(Line.REVENUE, p, p) for p in months]
    out = []
    growth_now = float(body.drivers.get("growth", 0))
    rates = sorted(float(b / a - 1) for a, b in zip(revenue, revenue[1:], strict=False) if a > 0)
    if len(rates) >= 5:
        quartile = rates[len(rates) // 4]
        value = round(max(-0.05, min(growth_now, quartile)), 4)
        if value < growth_now - 0.001:
            out.append(
                {
                    "key": "growth",
                    "from": growth_now,
                    "to": value,
                    "basis": "a weak month-on-month change in the last year (the lower quartile)",
                }
            )
    margins = [float((r + ledger.pnl(Line.COST_OF_SALES, p, p)) / r) for p, r in zip(months, revenue, strict=True) if r > 0]
    margin_now = float(body.drivers.get("grossMargin", 0))
    if len(margins) >= 5 and min(margins) < margin_now - 0.005:
        out.append(
            {
                "key": "grossMargin",
                "from": margin_now,
                "to": round(min(margins), 4),
                "basis": "the lowest monthly gross margin in the last year",
            }
        )
    days = []
    for p in months[2:]:
        r3 = ledger.pnl(Line.REVENUE, period_add(p, -2), p)
        if r3 > 0:
            days.append(float(ledger.line_balance(Line.DEBTORS, p) / r3 * 91))
    debtor_now = float(body.drivers.get("debtorDays", 0))
    if len(days) >= 5 and max(days) > debtor_now + 1:
        out.append(
            {
                "key": "debtorDays",
                "from": debtor_now,
                "to": round(max(days)),
                "basis": "the slowest customer payment in the last year",
            }
        )
    overhead_now = float(body.drivers.get("overheadGrowth", 0))
    out.append(
        {
            "key": "overheadGrowth",
            "from": overhead_now,
            "to": round(overhead_now + 0.03, 4),
            "basis": "costs rising three points faster than planned",
        }
    )
    return out


DRIVER_TEXT = {
    "growth": ("Monthly revenue growth", lambda v: ("−" if v < 0 else "") + pct(v)),
    "grossMargin": ("Gross margin", pct),
    "debtorDays": ("Debtor days", lambda v: f"{round(v)} days"),
    "overheadGrowth": ("Overheads growth a year", pct),
}


def downside(body: DownsideRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    changes = downside_changes(body)
    pack = Pack()
    for index, change in enumerate(changes, start=1):
        label, fmt = DRIVER_TEXT[change["key"]]
        pack.add(
            "changes",
            f"c{index}",
            f"{label}: from today's assumption to the downside ({change['basis']})",
            f"{fmt(change['from'])} to {fmt(change['to'])}",
            "Your last twelve months",
        )
    facts = pack.facts
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["name", "reasons"],
        "properties": {
            "name": {"type": "string", "description": "A short scenario name, three to six words"},
            "reasons": {
                "type": "array",
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["change", "text"],
                    "properties": {"change": {"type": "integer"}, "text": SEGMENTS},
                },
            },
        },
    }
    task = (
        "These are the changes for a downside scenario, each taken from the company's own worst recent month. For each "
        "change (c1, c2, …) write one short sentence saying what it assumes and why it's plausible, citing it. Then "
        "name the scenario in three to six words, without numbers."
    )

    def validate(payload: dict) -> dict:
        name = (payload.get("name") or "").strip().strip('"')
        if not name or len(name) > 48 or any(ch.isdigit() for ch in name):
            raise ActionInvalid("the name must be three to six words without numbers")
        reasons = {}
        for reason in payload.get("reasons") or []:
            index = int(reason.get("change", 0))
            if not 1 <= index <= len(changes):
                raise ActionInvalid("each reason needs its change number")
            reasons[index] = cited(reason["text"], facts, "a reason", 2)
        return {"name": name, "changes": [{**c, "reason": reasons.get(i, [])} for i, c in enumerate(changes, start=1)]}

    return run(settings, PROSE_RULES, facts_message(facts) + "\n\n" + task, schema, validate, http=http)
