"""Shapes exchanged between Convex and the engine for Xero work."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Tokens(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: float = Field(description="Unix seconds when the access token expires")


class Connection(BaseModel):
    tenant_id: str
    tenant_name: str = ""
    tenant_type: str = "ORGANISATION"


class Account(BaseModel):
    xero_account_id: str
    code: str = ""
    name: str
    type: str
    account_class: str = ""
    status: str = "ACTIVE"


class LedgerLine(BaseModel):
    xero_line_id: str
    xero_account_id: str
    account_code: str = ""
    net_cents: int
    description: str = ""
    contact: str = ""


class Journal(BaseModel):
    xero_journal_id: str
    journal_number: int
    date: str  # YYYY-MM-DD
    source_type: str = ""
    source_id: str = ""
    reference: str = ""
    lines: list[LedgerLine]


class OpenItem(BaseModel):
    """An unpaid invoice or bill, for ageing."""

    kind: str  # "receivable" | "payable"
    contact: str
    number: str = ""
    due_date: str  # YYYY-MM-DD
    amount_due_cents: int
