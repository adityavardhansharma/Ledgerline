"""Where each Xero account belongs in Ledgerline's statements.

Xero gives every account a ``Class`` (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE) and a ``Type``
(BANK, CURRENT, DIRECTCOSTS, OVERHEADS, ...). Statements are built from these alone, so a chart of
accounts we have never seen still lands in the right place.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Line(StrEnum):
    REVENUE = "revenue"
    COST_OF_SALES = "cost_of_sales"
    OVERHEADS = "overheads"
    DEPRECIATION = "depreciation"
    INTEREST = "interest"
    TAX = "tax"
    CASH = "cash"
    DEBTORS = "debtors"
    STOCK = "stock"
    OTHER_CURRENT_ASSET = "other_current_asset"
    FIXED_ASSET = "fixed_asset"
    CREDITORS = "creditors"
    TAX_LIABILITY = "tax_liability"
    OTHER_CURRENT_LIABILITY = "other_current_liability"
    LOAN = "loan"
    EQUITY = "equity"


PNL_LINES = {Line.REVENUE, Line.COST_OF_SALES, Line.OVERHEADS, Line.DEPRECIATION, Line.INTEREST, Line.TAX}
ASSET_LINES = {Line.CASH, Line.DEBTORS, Line.STOCK, Line.OTHER_CURRENT_ASSET, Line.FIXED_ASSET}
LIABILITY_LINES = {Line.CREDITORS, Line.TAX_LIABILITY, Line.OTHER_CURRENT_LIABILITY, Line.LOAN}
WORKING_CAPITAL_LINES = {
    Line.DEBTORS,
    Line.STOCK,
    Line.OTHER_CURRENT_ASSET,
    Line.CREDITORS,
    Line.TAX_LIABILITY,
    Line.OTHER_CURRENT_LIABILITY,
}

_TAX_WORDS = ("tax", "vat", "gst", "paye", "prsi")


@dataclass(frozen=True)
class AccountInfo:
    id: str
    code: str
    name: str
    type: str
    account_class: str
    system_account: str
    line: Line

    @property
    def is_pnl(self) -> bool:
        return self.line in PNL_LINES

    @property
    def is_wages(self) -> bool:
        lowered = self.name.lower()
        return self.type == "WAGESEXPENSE" or "wage" in lowered or "salar" in lowered


def classify(account: dict) -> AccountInfo:
    acc_type = (account.get("type") or "").upper()
    acc_class = (account.get("account_class") or "").upper()
    system = (account.get("system_account") or "").upper()
    name = account.get("name") or ""
    lowered = name.lower()

    if acc_type == "BANK":
        line = Line.CASH
    elif system == "DEBTORS":
        line = Line.DEBTORS
    elif system == "CREDITORS":
        line = Line.CREDITORS
    elif acc_type == "INVENTORY":
        line = Line.STOCK
    elif acc_type in ("CURRENT", "PREPAYMENT"):
        line = Line.OTHER_CURRENT_ASSET
    elif acc_type in ("FIXED", "NONCURRENT"):
        line = Line.FIXED_ASSET
    elif acc_type in ("TERMLIAB", "LIABILITY") or (acc_class == "LIABILITY" and "loan" in lowered):
        line = Line.LOAN
    elif acc_class == "LIABILITY" or acc_type in ("CURRLIAB", "PAYGLIABILITY", "SUPERANNUATIONLIABILITY"):
        line = (
            Line.TAX_LIABILITY
            if any(w in lowered for w in _TAX_WORDS) or system in ("GST", "TAX")
            else Line.OTHER_CURRENT_LIABILITY
        )
    elif acc_class == "EQUITY" or acc_type == "EQUITY":
        line = Line.EQUITY
    elif acc_class == "REVENUE" or acc_type in ("REVENUE", "SALES", "OTHERINCOME"):
        line = Line.REVENUE
    elif acc_type == "DIRECTCOSTS":
        line = Line.COST_OF_SALES
    elif acc_type == "DEPRECIATN":
        line = Line.DEPRECIATION
    elif "interest" in lowered:
        line = Line.INTEREST
    elif ("corporation tax" in lowered or "income tax" in lowered) and acc_class == "EXPENSE":
        line = Line.TAX
    elif acc_class == "ASSET":
        line = Line.OTHER_CURRENT_ASSET
    else:
        line = Line.OVERHEADS

    return AccountInfo(
        id=account["xero_account_id"],
        code=account.get("code") or "",
        name=name,
        type=acc_type,
        account_class=acc_class,
        system_account=system,
        line=line,
    )
