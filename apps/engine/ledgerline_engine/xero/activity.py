"""The transactions behind an account's monthly movement, rebuilt from Xero's documents.

Without journal access Xero won't list an account's postings, but it will list the documents that post:
invoices and bills, credit notes, payments, bank transactions and manual journals. Each document is turned
into the double entry it posts (debit positive, net of tax on income and expense lines, tax on the tax
account, the gross on debtors, creditors or the bank). Filtering those postings by account gives the
transactions behind a figure. Whatever the documents don't explain (depreciation from Xero's fixed assets,
payroll, conversion balances, bank transfers) is reported as a single unexplained amount, so the drill-down
always adds up to the figure in the statement.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from ..money import ZERO, to_cents, to_decimal
from .normalise import parse_xero_date

POSTED = {"AUTHORISED", "PAID"}


@dataclass(frozen=True)
class Roles:
    """Where the control sides of each document land, from the chart's system accounts."""

    debtors: str | None = None
    creditors: str | None = None
    tax: str | None = None
    codes: dict[str, str] = field(default_factory=dict)  # account code → account ID

    @classmethod
    def from_accounts(cls, accounts: list[dict]) -> Roles:
        by_system = {(a.get("system_account") or "").upper(): a["xero_account_id"] for a in accounts if a.get("system_account")}
        return cls(
            debtors=by_system.get("DEBTORS"),
            creditors=by_system.get("CREDITORS"),
            tax=by_system.get("GST") or by_system.get("VAT") or by_system.get("TAX"),
            codes={a["code"]: a["xero_account_id"] for a in accounts if a.get("code")},
        )


@dataclass(frozen=True)
class Posting:
    account_id: str
    date: str
    source: str  # Invoice, Bill, Credit note, Payment, Bank transaction, Manual journal
    reference: str
    contact: str
    description: str
    net: Decimal  # debit positive


def _date(doc: dict) -> str:
    return parse_xero_date(doc.get("DateString") or doc.get("Date"))


def _line_account(line: dict, roles: Roles) -> str | None:
    return line.get("AccountID") or roles.codes.get(line.get("AccountCode") or "")


def _net_of_tax(line: dict, amount_types: str) -> Decimal:
    amount = to_decimal(line.get("LineAmount"))
    return amount - to_decimal(line.get("TaxAmount")) if amount_types == "Inclusive" else amount


def _document(doc: dict, roles: Roles, *, sign: int, control: str | None, source: str, number_key: str) -> list[Posting]:
    """Sales-side documents credit their lines (sign −1); purchase-side documents debit them (sign +1)."""
    date = _date(doc)
    contact = (doc.get("Contact") or {}).get("Name") or ""
    reference = doc.get(number_key) or doc.get("Reference") or ""
    amount_types = doc.get("LineAmountTypes") or "Exclusive"
    out: list[Posting] = []
    for line in doc.get("LineItems") or []:
        account = _line_account(line, roles)
        if account:
            out.append(
                Posting(
                    account,
                    date,
                    source,
                    reference,
                    contact,
                    line.get("Description") or "",
                    sign * _net_of_tax(line, amount_types),
                )
            )
    tax = to_decimal(doc.get("TotalTax"))
    if tax and roles.tax:
        out.append(Posting(roles.tax, date, source, reference, contact, "Tax", sign * tax))
    if control:
        out.append(
            Posting(control, date, source, reference, contact, doc.get("Reference") or "", -sign * to_decimal(doc.get("Total")))
        )
    return out


def invoice_postings(invoices: list[dict], roles: Roles) -> list[Posting]:
    out: list[Posting] = []
    for inv in invoices:
        if inv.get("Status") not in POSTED:
            continue
        sales = inv.get("Type") == "ACCREC"
        out += _document(
            inv,
            roles,
            sign=-1 if sales else 1,
            control=roles.debtors if sales else roles.creditors,
            source="Invoice" if sales else "Bill",
            number_key="InvoiceNumber",
        )
    return out


def credit_note_postings(notes: list[dict], roles: Roles) -> list[Posting]:
    out: list[Posting] = []
    for note in notes:
        if note.get("Status") not in POSTED:
            continue
        sales = note.get("Type") == "ACCRECCREDIT"
        out += _document(
            note,
            roles,
            sign=1 if sales else -1,
            control=roles.debtors if sales else roles.creditors,
            source="Credit note",
            number_key="CreditNoteNumber",
        )
    return out


def bank_transaction_postings(transactions: list[dict], roles: Roles) -> list[Posting]:
    out: list[Posting] = []
    for txn in transactions:
        if txn.get("Status") != "AUTHORISED":
            continue
        kind = txn.get("Type") or ""
        receive = kind.startswith("RECEIVE")
        bank = (txn.get("BankAccount") or {}).get("AccountID")
        if kind.endswith("TRANSFER"):
            if bank:
                total = to_decimal(txn.get("Total"))
                out.append(
                    Posting(
                        bank,
                        _date(txn),
                        "Bank transfer",
                        txn.get("Reference") or "",
                        "",
                        "Transfer",
                        total if receive else -total,
                    )
                )
            continue
        out += _document(txn, roles, sign=-1 if receive else 1, control=bank, source="Bank transaction", number_key="Reference")
    return out


def manual_journal_postings(journals: list[dict], roles: Roles) -> list[Posting]:
    out: list[Posting] = []
    for mj in journals:
        if mj.get("Status") != "POSTED":
            continue
        amount_types = mj.get("LineAmountTypes") or "NoTax"
        for line in mj.get("JournalLines") or []:
            account = _line_account(line, roles)
            if account:
                out.append(
                    Posting(
                        account,
                        _date(mj),
                        "Manual journal",
                        "",
                        "",
                        line.get("Description") or mj.get("Narration") or "",
                        _net_of_tax(line, amount_types),
                    )
                )
            tax = to_decimal(line.get("TaxAmount"))
            if tax and roles.tax:
                out.append(Posting(roles.tax, _date(mj), "Manual journal", "", "", "Tax", tax))
    return out


# Payment types: (bank sign, control account role)
PAYMENT_SIDES = {
    "ACCRECPAYMENT": (1, "debtors"),
    "ACCPAYPAYMENT": (-1, "creditors"),
    "ARCREDITPAYMENT": (-1, "debtors"),
    "APCREDITPAYMENT": (1, "creditors"),
}


def payment_postings(payments: list[dict], roles: Roles) -> list[Posting]:
    out: list[Posting] = []
    for p in payments:
        sides = PAYMENT_SIDES.get(p.get("PaymentType") or "")
        if not sides or p.get("Status") != "AUTHORISED":
            continue
        bank_sign, role = sides
        amount = to_decimal(p.get("Amount"))
        document = p.get("Invoice") or p.get("CreditNote") or {}
        contact = (document.get("Contact") or {}).get("Name") or ""
        reference = document.get("InvoiceNumber") or document.get("CreditNoteNumber") or p.get("Reference") or ""
        bank = (p.get("Account") or {}).get("AccountID")
        if bank:
            out.append(Posting(bank, _date(p), "Payment", reference, contact, p.get("Reference") or "", bank_sign * amount))
        control = getattr(roles, role)
        if control:
            out.append(Posting(control, _date(p), "Payment", reference, contact, p.get("Reference") or "", -bank_sign * amount))
    return out


def account_activity(account_id: str, postings: list[Posting], movement_cents: int) -> dict:
    """The postings on one account, oldest first, and whatever part of the movement they don't explain."""
    mine = sorted((p for p in postings if p.account_id == account_id), key=lambda p: (p.date, p.source, p.reference))
    explained = sum(to_cents(p.net) for p in mine)
    return {
        "lines": [
            {
                "date": p.date,
                "source": p.source,
                "reference": p.reference,
                "contact": p.contact,
                "description": p.description,
                "net_cents": to_cents(p.net),
            }
            for p in mine
            if to_cents(p.net)
        ],
        "explained_cents": explained,
        "unexplained_cents": movement_cents - explained,
    }


def daily_cash(postings: list[Posting], bank_ids: set[str]) -> list[dict]:
    """Net movement on the bank accounts per day, from payments and bank transactions."""
    days: dict[str, Decimal] = {}
    for p in postings:
        if p.account_id in bank_ids and p.date:
            days[p.date] = days.get(p.date, ZERO) + p.net
    return [{"date": d, "net_cents": to_cents(v)} for d, v in sorted(days.items()) if to_cents(v)]
