"""Turn raw Xero payloads into Ledgerline's canonical records."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from decimal import Decimal

from ..money import to_cents, to_decimal
from .models import Account, Journal, LedgerLine, OpenItem

_MS_DATE = re.compile(r"/Date\((-?\d+)([+-]\d{4})?\)/")


class UnbalancedJournal(ValueError):
    """A journal whose lines do not sum to zero. Never stored."""


def parse_xero_date(value: str | None) -> str:
    """Xero returns ``/Date(1572566400000+0000)/`` or ISO strings. Return ``YYYY-MM-DD``."""
    if not value:
        return ""
    match = _MS_DATE.match(value)
    if match:
        ms = int(match.group(1))
        return datetime.fromtimestamp(ms / 1000, tz=UTC).strftime("%Y-%m-%d")
    return value[:10]


def normalise_account(raw: dict) -> Account:
    return Account(
        xero_account_id=raw["AccountID"],
        code=raw.get("Code") or "",
        name=raw.get("Name") or "",
        type=raw.get("Type") or "",
        account_class=raw.get("Class") or "",
        status=raw.get("Status") or "ACTIVE",
    )


def normalise_journal(raw: dict) -> Journal:
    lines: list[LedgerLine] = []
    total = Decimal("0")
    for raw_line in raw.get("JournalLines") or []:
        net = to_decimal(raw_line.get("NetAmount"))
        total += net
        lines.append(
            LedgerLine(
                xero_line_id=raw_line.get("JournalLineID") or "",
                xero_account_id=raw_line.get("AccountID") or "",
                account_code=raw_line.get("AccountCode") or "",
                net_cents=to_cents(net),
                description=(raw_line.get("Description") or "")[:500],
                contact="",
            )
        )
    # Net amounts are tax-exclusive; the tax lands on its own line, so a posted journal nets to zero.
    if abs(total) > Decimal("0.005"):
        raise UnbalancedJournal(f"journal {raw.get('JournalNumber')} nets to {total}")
    return Journal(
        xero_journal_id=raw["JournalID"],
        journal_number=int(raw["JournalNumber"]),
        date=parse_xero_date(raw.get("JournalDate")),
        source_type=raw.get("SourceType") or "",
        source_id=raw.get("SourceID") or "",
        reference=(raw.get("Reference") or "")[:200],
        lines=lines,
    )


def normalise_open_item(raw: dict) -> OpenItem | None:
    due = to_decimal(raw.get("AmountDue"))
    if due <= 0:
        return None
    kind = "receivable" if raw.get("Type") == "ACCREC" else "payable"
    return OpenItem(
        kind=kind,
        contact=(raw.get("Contact") or {}).get("Name") or "",
        number=raw.get("InvoiceNumber") or "",
        due_date=parse_xero_date(raw.get("DueDate") or raw.get("DueDateString")),
        amount_due_cents=to_cents(due),
    )
