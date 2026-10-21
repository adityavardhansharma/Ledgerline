"""Monthly account movements from Xero's Trial Balance report, for apps without journal access.

Xero's Trial Balance "as at" a date has two pairs of columns: Debit and Credit for the month up to that
date, and YTD Debit and YTD Credit (the year to date for profit and loss accounts, the balance for balance
sheet accounts). One report per month end gives each account's movement for that month; the report at the
end of the month before the history starts gives the opening position.

The result has the same shape as journals summed by account and month, so statements, forecasts and the
check against Xero work unchanged. Two things need care:

* Xero closes last year's profit into Retained Earnings in its reports, which journals never do. Every
  month's movements must sum to zero, so any residual (the year-end roll-over, or a report row Xero shows
  without an account) is moved to the retained earnings account.
* Rows without an account ID (some system lines) become synthetic accounts named after the row.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from ..money import ZERO, to_cents, to_decimal

RETAINED_ID = "xero:retained-earnings"
SECTION_TYPES = {
    "revenue": ("REVENUE", "REVENUE"),
    "income": ("REVENUE", "REVENUE"),
    "expenses": ("OVERHEADS", "EXPENSE"),
    "assets": ("CURRENT", "ASSET"),
    "liabilities": ("CURRLIAB", "LIABILITY"),
    "equity": ("EQUITY", "EQUITY"),
}


@dataclass(frozen=True)
class TrialBalanceRow:
    account_id: str | None
    name: str
    section: str
    month_net: Decimal  # debit positive
    ytd_net: Decimal


def _columns(report: dict) -> dict[str, int]:
    for row in report.get("Rows") or []:
        if row.get("RowType") == "Header":
            titles = [(c.get("Value") or "").strip().lower() for c in row.get("Cells") or []]
            found = {t: i for i, t in enumerate(titles)}
            return {
                "debit": found.get("debit", 1),
                "credit": found.get("credit", 2),
                "ytd_debit": found.get("ytd debit", 3),
                "ytd_credit": found.get("ytd credit", 4),
            }
    return {"debit": 1, "credit": 2, "ytd_debit": 3, "ytd_credit": 4}


def parse_trial_balance(report: dict) -> list[TrialBalanceRow]:
    cols = _columns(report)
    out: list[TrialBalanceRow] = []

    def value(cells: list[dict], index: int) -> Decimal:
        return to_decimal(cells[index].get("Value")) if index < len(cells) else ZERO

    def walk(rows, section: str):
        for row in rows or []:
            kind = row.get("RowType")
            if kind == "Section":
                walk(row.get("Rows"), (row.get("Title") or section or "").strip())
            elif kind == "Row":
                cells = row.get("Cells") or []
                if not cells:
                    continue
                attrs = cells[0].get("Attributes") or []
                account_id = next((a.get("Value") for a in attrs if a.get("Id") == "account"), None)
                out.append(
                    TrialBalanceRow(
                        account_id=account_id,
                        name=(cells[0].get("Value") or "").strip(),
                        section=section,
                        month_net=value(cells, cols["debit"]) - value(cells, cols["credit"]),
                        ytd_net=value(cells, cols["ytd_debit"]) - value(cells, cols["ytd_credit"]),
                    )
                )

    walk(report.get("Rows"), "")
    return out


def _synthetic_id(name: str) -> str:
    return "xero:row:" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def monthly_movements(reports: dict[str, dict], opening_period: str | None, retained_earnings_id: str | None) -> dict:
    """``reports`` maps each period (YYYY-MM) to the Trial Balance at that month's end.

    The opening period's report contributes its year-to-date columns (the position brought forward); every
    other period contributes its month columns.
    """
    retained = retained_earnings_id or RETAINED_ID
    synthetic: dict[str, dict] = {}
    periods: list[dict] = []
    adjustments: dict[str, int] = {}

    for period in sorted(reports):
        totals: dict[str, int] = {}
        for row in parse_trial_balance(reports[period]):
            account_id = row.account_id
            if not account_id:
                account_id = _synthetic_id(row.name)
                kind, cls = SECTION_TYPES.get(row.section.lower(), ("CURRENT", "ASSET"))
                synthetic.setdefault(
                    account_id,
                    {
                        "xero_account_id": account_id,
                        "code": "",
                        "name": row.name,
                        "type": kind,
                        "account_class": cls,
                        "system_account": "",
                    },
                )
            net = to_cents(row.ytd_net if period == opening_period else row.month_net)
            if net:
                totals[account_id] = totals.get(account_id, 0) + net
        residual = sum(totals.values())
        if residual:
            totals[retained] = totals.get(retained, 0) - residual
            adjustments[period] = -residual
            if retained == RETAINED_ID:
                synthetic.setdefault(
                    RETAINED_ID,
                    {
                        "xero_account_id": RETAINED_ID,
                        "code": "",
                        "name": "Retained earnings",
                        "type": "EQUITY",
                        "account_class": "EQUITY",
                        "system_account": "RETAINEDEARNINGS",
                    },
                )
        periods.append(
            {"period": period, "lines": [{"xero_account_id": a, "net_cents": c} for a, c in sorted(totals.items()) if c]}
        )

    return {"periods": periods, "syntheticAccounts": list(synthetic.values()), "retainedAdjustments": adjustments}
