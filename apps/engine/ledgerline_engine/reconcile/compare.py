"""Compare Ledgerline's figures with Xero's own Profit and Loss and Balance Sheet reports.

Xero report rows carry the account ID in the first cell's attributes; columns run newest month first.
Xero shows expenses and liabilities as positive numbers, so each account is compared on Xero's sign.
"""

from __future__ import annotations

from ..money import ZERO, to_cents, to_decimal
from ..statements.build import Ledger, period_add
from ..statements.classify import ASSET_LINES, Line


def _account_rows(report: dict):
    def walk(rows):
        for row in rows or []:
            if row.get("RowType") == "Section":
                yield from walk(row.get("Rows"))
            elif row.get("RowType") == "Row":
                cells = row.get("Cells") or []
                if not cells:
                    continue
                attrs = cells[0].get("Attributes") or []
                account_id = next((a.get("Value") for a in attrs if a.get("Id") == "account"), None)
                if account_id:
                    yield account_id, cells[0].get("Value") or "", [to_decimal(c.get("Value")) for c in cells[1:]]

    yield from walk(report.get("Rows"))


def _xero_sign(ledger: Ledger, account_id: str) -> int:
    info = ledger.accounts.get(account_id)
    if info is None:
        return 1
    if info.line in (Line.REVENUE,) or info.line in ASSET_LINES:
        return 1
    return -1


def compare(ledger: Ledger, profit_and_loss: dict | None, balance_sheet: dict | None, as_of: str, months: int = 12) -> dict:
    periods = [period_add(as_of, -k) for k in range(months)]  # newest first, like Xero's columns
    differences: list[dict] = []
    compared = 0

    for account_id, name, values in _account_rows(profit_and_loss or {}):
        sign = _xero_sign(ledger, account_id)
        for period, xero in zip(periods, values, strict=False):
            ours = -ledger.moved(account_id, period, period) * sign
            compared += 1
            if to_cents(ours) != to_cents(xero):
                differences.append(_diff(account_id, name, period, ours, xero))

    for account_id, name, values in _account_rows(balance_sheet or {}):
        info = ledger.accounts.get(account_id)
        is_asset = info is not None and info.line in ASSET_LINES
        for period, xero in zip(periods, values, strict=False):
            balance = ledger.balance(account_id, period)
            ours = balance if is_asset else -balance
            compared += 1
            if to_cents(ours) != to_cents(xero):
                differences.append(_diff(account_id, name, period, ours, xero))

    return {
        "status": "match" if not differences else "mismatch",
        "compared": compared,
        "accounts": len(
            {a for a, _, _ in _account_rows(profit_and_loss or {})} | {a for a, _, _ in _account_rows(balance_sheet or {})}
        ),
        "differences": differences[:50],
        "totalDifference": sum((d["diffCents"] for d in differences), 0),
    }


def _diff(account_id: str, name: str, period: str, ours, xero) -> dict:
    return {
        "accountId": account_id,
        "name": name,
        "period": period,
        "oursCents": to_cents(ours),
        "xeroCents": to_cents(xero or ZERO),
        "diffCents": to_cents(ours) - to_cents(xero or ZERO),
    }
