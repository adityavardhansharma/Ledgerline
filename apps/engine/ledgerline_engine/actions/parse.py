"""Parsing actions: the person's own words into fields they confirm. Numbers must come from their words."""

from __future__ import annotations

import re
from datetime import date

import httpx
from pydantic import BaseModel, Field

from ..commentary.facts import month_name
from ..settings import Settings
from .common import ActionInvalid, is_stated, run, stated_numbers

DRIVERS = {
    "growth": "monthly revenue growth, percent",
    "grossMargin": "gross margin, percent",
    "overheadGrowth": "overheads growth a year, percent",
    "debtorDays": "debtor days",
    "creditorDays": "creditor days",
    "stockDays": "stock days",
}

PARSE_RULES = (
    "You turn what a small business owner typed into structured fields for them to confirm. Use only what they "
    "said: never invent an amount, a month or an item, and never fill a gap with a guess. Copy every number "
    'exactly as they gave it ("42k" is 42000). Anything you can\'t place goes in not_understood, in a few words.'
)


# ---------- a scenario from a sentence ----------


class ParseScenarioRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    start_period: str  # first forecast month, YYYY-MM


def _months(start: str, count: int = 24) -> list[str]:
    year, month = int(start[:4]), int(start[5:7])
    out = []
    for _ in range(count):
        out.append(f"{year:04d}-{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return out


def parse_scenario(body: ParseScenarioRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    periods = _months(body.start_period)
    period = {"type": "string", "enum": periods}
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["hires", "one_offs", "financing", "assumptions", "not_understood"],
        "properties": {
            "hires": {
                "type": "array",
                "maxItems": 10,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["role", "annual_salary", "count", "start_period"],
                    "properties": {
                        "role": {"type": "string"},
                        "annual_salary": {"type": "number"},
                        "count": {"type": "integer"},
                        "start_period": period,
                    },
                },
            },
            "one_offs": {
                "type": "array",
                "maxItems": 10,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["label", "kind", "amount", "period"],
                    "properties": {
                        "label": {"type": "string"},
                        "kind": {
                            "type": "string",
                            "enum": ["capex", "income", "expense"],
                            "description": "capex for equipment, vans, machines",
                        },
                        "amount": {"type": "number"},
                        "period": period,
                    },
                },
            },
            "financing": {
                "type": "array",
                "maxItems": 10,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["kind", "amount", "period"],
                    "properties": {
                        "kind": {"type": "string", "enum": ["loan", "equity", "dividend"]},
                        "amount": {"type": "number"},
                        "period": period,
                    },
                },
            },
            "assumptions": {
                "type": "array",
                "maxItems": 6,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["key", "value"],
                    "properties": {
                        "key": {"type": "string", "enum": list(DRIVERS)},
                        "value": {"type": "number", "description": "percent for percentages, days for days"},
                    },
                },
            },
            "not_understood": {"type": "string"},
        },
    }
    calendar = ", ".join(f"{p} = {month_name(p)}" for p in periods)
    user = (
        f"The forecast runs from {month_name(periods[0])} for 24 months: {calendar}. A month named without a year means "
        f"the first one in that range. Drivers: {DRIVERS}.\n\nWhat they typed:\n{body.text}"
    )
    stated = stated_numbers(body.text)

    def check(value: float, what: str) -> float:
        if not is_stated(value, stated):
            raise ActionInvalid(f"{what} {value:g} is not a number they wrote; leave it out or use their number")
        return value

    def validate(p: dict) -> dict:
        out = {
            "hires": [],
            "oneOffs": [],
            "financing": [],
            "assumptions": [],
            "notUnderstood": (p.get("not_understood") or "").strip(),
        }
        for h in p.get("hires") or []:
            count = int(h["count"])
            if not 1 <= count <= 50 or not h["role"].strip():
                raise ActionInvalid("a hire needs a role and between one and fifty people")
            out["hires"].append(
                {
                    "role": h["role"].strip()[:80],
                    "salaryCents": round(check(h["annual_salary"], "salary") * 100),
                    "count": count,
                    "startPeriod": h["start_period"],
                }
            )
        for o in p.get("one_offs") or []:
            out["oneOffs"].append(
                {
                    "label": o["label"].strip()[:80] or "One-off",
                    "kind": o["kind"],
                    "amountCents": round(check(o["amount"], "amount") * 100),
                    "period": o["period"],
                }
            )
        for f in p.get("financing") or []:
            out["financing"].append(
                {"kind": f["kind"], "amountCents": round(check(f["amount"], "amount") * 100), "period": f["period"]}
            )
        for a in p.get("assumptions") or []:
            value = check(a["value"], a["key"])
            out["assumptions"].append(
                {"key": a["key"], "value": value / 100 if a["key"] in ("growth", "grossMargin", "overheadGrowth") else value}
            )
        for group in ("hires", "oneOffs", "financing"):
            for item in out[group]:
                if item.get("startPeriod", item.get("period")) not in periods:
                    raise ActionInvalid("use a month from the forecast")
                if (item.get("salaryCents") or item.get("amountCents") or 0) <= 0:
                    raise ActionInvalid("amounts must be positive")
        return out

    return run(settings, PARSE_RULES, user, schema, validate, name="scenario", http=http)


# ---------- help with a CSV that doesn't fit ----------

FIELDS = {
    "accounts": ["code", "name", "type", "system"],
    "journals": ["journal", "date", "account", "description", "debit", "credit", "amount", "reference", "source", "contact"],
}
FIELD_HELP = {
    "code": "account code",
    "name": "account name",
    "type": "account type",
    "system": "system account flag (DEBTORS, CREDITORS)",
    "journal": "journal or entry number that groups lines",
    "date": "date",
    "account": "account code on each line",
    "description": "narration",
    "debit": "debit amount",
    "credit": "credit amount",
    "amount": "one signed amount column (debits positive), only if there are no debit/credit columns",
    "reference": "reference",
    "source": "source or transaction type",
    "contact": "customer or supplier name",
}


class ImportMapRequest(BaseModel):
    file: str = Field(pattern="^(accounts|journals)$")
    headers: list[str] = Field(max_length=60)
    sample: list[list[str]] = Field(default_factory=list, max_length=5)
    unknown_types: list[str] = Field(default_factory=list, max_length=60)
    allowed_types: list[str] = Field(default_factory=list, max_length=60)


def import_map(body: ImportMapRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    fields = FIELDS[body.file]
    headers = [h for h in body.headers if h.strip()]
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["columns", "types", "note"],
        "properties": {
            "columns": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["field", "header"],
                    "properties": {
                        "field": {"type": "string", "enum": fields},
                        "header": {"type": "string", "enum": [*headers, ""]},
                    },
                },
            },
            "types": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["raw", "type"],
                    "properties": {
                        "raw": {"type": "string", "enum": [*body.unknown_types, ""]},
                        "type": {"type": "string", "enum": [*body.allowed_types, ""]},
                    },
                },
            },
            "note": {"type": "string"},
        },
    }
    rows = "\n".join(" | ".join(cell[:40] for cell in row[:20]) for row in body.sample[:5])
    user = (
        f"A {body.file} CSV from another accounting system. Match each field Ledgerline needs to one of the file's "
        f'columns, or "" if none fits. Fields: {", ".join(f"{f} ({FIELD_HELP[f]})" for f in fields)}.\n'
        f"Columns: {headers}\nFirst rows:\n{rows or '(none)'}\n"
    )
    if body.unknown_types:
        user += (
            f"\nThese account types aren't recognised: {body.unknown_types}. Give each the closest Xero type from "
            f'{body.allowed_types}, judging by the account names in the rows, or "" if unsure.'
        )
    user += "\nIn note, one sentence on anything the person should check."

    def validate(p: dict) -> dict:
        columns = {}
        for c in p.get("columns") or []:
            if c["field"] in fields and (c["header"] in headers):
                columns.setdefault(c["field"], c["header"])
        if len(set(columns.values())) < len(columns):
            raise ActionInvalid("two fields were matched to the same column")
        types = {
            t["raw"]: t["type"]
            for t in p.get("types") or []
            if t["raw"] in body.unknown_types and t["type"] in body.allowed_types
        }
        return {"columns": columns, "types": types, "note": (p.get("note") or "").strip()[:300]}

    return run(settings, PARSE_RULES, user, schema, validate, name="import_map", http=http)


# ---------- a name for a scenario ----------


class NameScenarioRequest(BaseModel):
    parent: str = "Base case"
    changes: str = Field(min_length=1, max_length=1000)


def name_scenario(body: NameScenarioRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["names"],
        "properties": {"names": {"type": "array", "maxItems": 3, "items": {"type": "string"}}},
    }
    user = f'A forecast scenario branched from "{body.parent}" changes: {body.changes}. Suggest three short names (two to six words, sentence case) that say what it tests.'

    def validate(p: dict) -> dict:
        names = [n.strip().strip('"').rstrip(".") for n in p.get("names") or []]
        names = [n for n in names if 0 < len(n) <= 48]
        if not names:
            raise ActionInvalid("give at least one short name")
        return {"names": names[:3]}

    return run(
        settings, "You name things in a finance app. Short, plain, specific.", user, schema, validate, name="names", http=http
    )


# ---------- ledger search in plain words ----------


class SearchParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    today: str
    accounts: list[dict] = Field(default_factory=list, max_length=600)  # {code, name}
    contacts: list[str] = Field(default_factory=list, max_length=400)
    first_date: str | None = None


ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def search_parse(body: SearchParseRequest, settings: Settings, http: httpx.Client | None = None) -> dict:
    codes = [a["code"] for a in body.accounts if a.get("code")]
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["accounts", "contact", "words", "date_from", "date_to", "min_amount", "max_amount", "side"],
        "properties": {
            "accounts": {"type": "array", "maxItems": 10, "items": {"type": "string", "enum": codes or [""]}},
            "contact": {"type": "string", "enum": [*body.contacts, ""]},
            "words": {"type": "string", "description": "free words to match in descriptions and references, or empty"},
            "date_from": {"type": "string", "description": "YYYY-MM-DD or empty"},
            "date_to": {"type": "string", "description": "YYYY-MM-DD or empty"},
            "min_amount": {"type": ["number", "null"]},
            "max_amount": {"type": ["number", "null"]},
            "side": {"type": "string", "enum": ["any", "debit", "credit"]},
        },
    }
    chart = "; ".join(f"{a['code']} {a['name']}" for a in body.accounts[:600])
    user = (
        f"Turn this ledger search into filters. Today is {body.today}"
        f"{'; the ledger starts ' + body.first_date if body.first_date else ''}. Quarters are calendar quarters of the "
        f'current year unless a year is given. "Payments to X" means lines with contact X. Use accounts only when the '
        f"search names an account or a kind of cost or income.\nChart of accounts: {chart}\n"
        f"Contacts: {', '.join(body.contacts[:400]) or '(none)'}\n\nSearch: {body.text}"
    )
    stated = stated_numbers(body.text)

    def validate(p: dict) -> dict:
        for key in ("date_from", "date_to"):
            if p.get(key) and not ISO.match(p[key]):
                raise ActionInvalid(f"{key} must be YYYY-MM-DD or empty")
            if p.get(key):
                date.fromisoformat(p[key])
        for key in ("min_amount", "max_amount"):
            if p.get(key) is not None and not is_stated(float(p[key]), stated):
                raise ActionInvalid(f"{key} must be a number from the search")
        return {
            "accounts": [c for c in p.get("accounts") or [] if c in codes],
            "contact": p.get("contact") or "",
            "words": (p.get("words") or "").strip()[:80],
            "dateFrom": p.get("date_from") or "",
            "dateTo": p.get("date_to") or "",
            "minCents": None if p.get("min_amount") is None else round(float(p["min_amount"]) * 100),
            "maxCents": None if p.get("max_amount") is None else round(float(p["max_amount"]) * 100),
            "side": p.get("side") or "any",
        }

    return run(settings, PARSE_RULES, user, schema, validate, name="search", http=http)
