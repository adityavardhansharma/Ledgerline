"""HTTP surface of the finance engine. Every route is stateless; Convex holds all state."""

from __future__ import annotations

import calendar
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import __version__
from .commentary.draft import CommentaryInvalid, answer, draft
from .commentary.facts import BoardInput, build_facts
from .forecast.model import ForecastImbalance, ForecastRequest, forecast
from .reconcile.ageing import age
from .reconcile.compare import compare
from .settings import Settings, get_settings
from .signing import verify
from .statements.build import Ledger, StatementError, build_all
from .xero.activity import (
    Roles,
    account_activity,
    bank_transaction_postings,
    credit_note_postings,
    daily_cash,
    invoice_postings,
    manual_journal_postings,
    payment_postings,
)
from .xero.balances import monthly_movements
from .xero.client import JOURNALS_SCOPE, RateLimited, ReauthRequired, XeroClient, XeroError
from .xero.models import Tokens
from .xero.normalise import UnbalancedJournal, normalise_account, normalise_journal, normalise_open_item, parse_xero_date

app = FastAPI(title="Ledgerline engine", version=__version__)
SettingsDep = Annotated[Settings, Depends(get_settings)]


@app.middleware("http")
async def require_signature(request: Request, call_next):
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)
    settings = get_settings()
    if not settings.allow_unsigned:
        body = await request.body()
        ok = verify(
            settings.engine_secret,
            request.headers.get("x-ll-timestamp"),
            request.headers.get("x-ll-signature"),
            request.method,
            request.url.path,
            body,
            settings.signature_window_seconds,
        )
        if not ok:
            return JSONResponse({"error": "unsigned"}, status_code=401)
    return await call_next(request)


@app.exception_handler(RateLimited)
async def rate_limited(_: Request, exc: RateLimited):
    return JSONResponse({"error": "rate_limited", "retryAfter": exc.retry_after}, status_code=429)


@app.exception_handler(ReauthRequired)
async def reauth(_: Request, exc: ReauthRequired):
    return JSONResponse({"error": "reauth", "message": str(exc)}, status_code=401)


@app.exception_handler(XeroError)
async def xero_error(_: Request, exc: XeroError):
    return JSONResponse({"error": "xero", "status": exc.status, "message": str(exc)}, status_code=502)


@app.exception_handler(UnbalancedJournal)
async def unbalanced(_: Request, exc: UnbalancedJournal):
    return JSONResponse({"error": "unbalanced_journal", "message": str(exc)}, status_code=422)


@app.exception_handler(StatementError)
@app.exception_handler(ForecastImbalance)
async def integrity(_: Request, exc: AssertionError):
    return JSONResponse({"error": "integrity", "message": str(exc)}, status_code=500)


class TenantRequest(BaseModel):
    tokens: Tokens
    tenant_id: str


def _client(settings: Settings, body: TenantRequest) -> XeroClient:
    return XeroClient(settings, tokens=body.tokens, tenant_id=body.tenant_id)


def _with_tokens(client: XeroClient, payload: dict) -> dict:
    if client.rotated and client.tokens:
        payload["tokens"] = client.tokens.model_dump()
    return payload


@app.get("/health")
def health():
    return {"ok": True, "version": __version__}


class AuthorizeRequest(BaseModel):
    redirect_uri: str
    state: str
    code_challenge: str


@app.post("/xero/authorize-url")
def authorize_url(body: AuthorizeRequest, settings: SettingsDep):
    return {
        "url": XeroClient(settings).authorize_url(body.redirect_uri, body.state, body.code_challenge),
        "journals": settings.xero_journals,
    }


class TokenRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str


@app.post("/xero/token")
def exchange(body: TokenRequest, settings: SettingsDep):
    client = XeroClient(settings)
    tokens = client.exchange_code(body.code, body.redirect_uri, body.code_verifier)
    return {
        "tokens": tokens.model_dump(),
        "scopes": tokens.scope.split(),
        "journals": JOURNALS_SCOPE in tokens.scope.split(),
        "connections": [c.model_dump() for c in client.connections()],
    }


@app.post("/xero/accounts")
def accounts(body: TenantRequest, settings: SettingsDep):
    client = _client(settings, body)
    return _with_tokens(client, {"accounts": [normalise_account(a).model_dump() for a in client.accounts()]})


class JournalsRequest(TenantRequest):
    offset: int = 0


@app.post("/xero/journals")
def journals(body: JournalsRequest, settings: SettingsDep):
    client = _client(settings, body)
    raw = client.journals(body.offset)
    items = [normalise_journal(j).model_dump() for j in raw]
    next_offset = max((j["journal_number"] for j in items), default=body.offset)
    return _with_tokens(client, {"journals": items, "nextOffset": next_offset, "fullPage": len(raw) >= 100})


class JournalCheckRequest(TenantRequest):
    journal_number: int
    xero_journal_id: str


@app.post("/xero/journal-check")
def journal_check(body: JournalCheckRequest, settings: SettingsDep):
    """Detect a reset organisation (Xero's Demo Company resets every 28 days)."""
    client = _client(settings, body)
    raw = client.journals(max(0, body.journal_number - 1))
    first = raw[0] if raw else None
    ok = bool(first) and first.get("JournalID") == body.xero_journal_id
    return _with_tokens(client, {"ok": ok})


class OpenItemsRequest(TenantRequest):
    as_of: str  # YYYY-MM-DD


@app.post("/xero/open-items")
def open_items(body: OpenItemsRequest, settings: SettingsDep):
    client = _client(settings, body)
    items, page = [], 1
    while True:
        raw = client.open_invoices(page)
        items.extend(i for i in (normalise_open_item(r) for r in raw) if i is not None)
        if len(raw) < 100 or page >= 20:
            break
        page += 1
    return _with_tokens(client, {"ageing": age([i.model_dump() for i in items], body.as_of), "count": len(items)})


def _month_end(period: str) -> str:
    year, month = int(period[:4]), int(period[5:7])
    return f"{period}-{calendar.monthrange(year, month)[1]:02d}"


class TrialBalancesRequest(TenantRequest):
    periods: list[str] = Field(min_length=1, max_length=12)  # YYYY-MM
    opening_period: str | None = None  # contributes its year-to-date position instead of its month
    retained_earnings_id: str | None = None
    today: str  # YYYY-MM-DD; the current month is read up to today


@app.post("/xero/trial-balances")
def trial_balances(body: TrialBalancesRequest, settings: SettingsDep):
    """Monthly movements per account from one Trial Balance per month end, for apps without journal access."""
    client = _client(settings, body)
    reports = {period: client.trial_balance(min(_month_end(period), body.today)) for period in body.periods}
    return _with_tokens(client, monthly_movements(reports, body.opening_period, body.retained_earnings_id))


class ChartRequest(TenantRequest):
    accounts: list[dict]


class DailyCashRequest(ChartRequest):
    date_from: str
    date_to: str


@app.post("/xero/daily-cash")
def cash_by_day(body: DailyCashRequest, settings: SettingsDep):
    """Net bank movement per day from payments and bank transactions (the cash calendar)."""
    client = _client(settings, body)
    roles = Roles.from_accounts(body.accounts)
    banks = {a["xero_account_id"] for a in body.accounts if (a.get("type") or "").upper() == "BANK"}
    postings = payment_postings(client.optional_documents("Payments", "Payments", body.date_from, body.date_to), roles)
    postings += bank_transaction_postings(
        client.optional_documents("BankTransactions", "BankTransactions", body.date_from, body.date_to), roles
    )
    return _with_tokens(client, {"days": daily_cash(postings, banks)})


class ActivityRequest(ChartRequest):
    account_id: str
    period: str  # YYYY-MM
    movement_cents: int


@app.post("/xero/account-activity")
def activity(body: ActivityRequest, settings: SettingsDep):
    """The invoices, bills, payments, bank transactions and manual journals behind one account's month."""
    client = _client(settings, body)
    roles = Roles.from_accounts(body.accounts)
    account = next((a for a in body.accounts if a["xero_account_id"] == body.account_id), {})
    first, last = f"{body.period}-01", _month_end(body.period)
    is_bank = (account.get("type") or "").upper() == "BANK"
    is_control = body.account_id in (roles.debtors, roles.creditors)
    postings = []
    if not is_bank:
        postings += invoice_postings(client.optional_documents("Invoices", "Invoices", first, last), roles)
        postings += credit_note_postings(client.optional_documents("CreditNotes", "CreditNotes", first, last), roles)
    if is_bank or is_control:
        postings += payment_postings(client.optional_documents("Payments", "Payments", first, last), roles)
    if not is_control:
        postings += bank_transaction_postings(
            client.optional_documents("BankTransactions", "BankTransactions", first, last), roles
        )
    if not is_bank and not is_control:
        postings += manual_journal_postings(client.optional_documents("ManualJournals", "ManualJournals", first, last), roles)
    return _with_tokens(client, account_activity(body.account_id, postings, body.movement_cents))


class BuildRequest(BaseModel):
    accounts: list[dict]
    balances: list[dict]
    fy_start_month: int = Field(default=1, ge=1, le=12)
    as_of: str


@app.post("/reports/build")
def reports_build(body: BuildRequest):
    return build_all(body.accounts, body.balances, body.fy_start_month, body.as_of)


class ReconcileRequest(TenantRequest):
    accounts: list[dict]
    balances: list[dict]
    as_of: str
    months: int = Field(default=12, ge=1, le=12)
    fy_start_month: int = Field(default=1, ge=1, le=12)


@app.post("/reconcile")
def reconcile(body: ReconcileRequest, settings: SettingsDep):
    client = _client(settings, body)
    first = f"{body.as_of}-01"
    end = _month_end(body.as_of)
    pnl = client.profit_and_loss(first, end, body.months - 1)
    bs = client.balance_sheet(end, body.months - 1)
    ledger = Ledger.from_payload(body.accounts, body.balances)
    return _with_tokens(client, compare(ledger, pnl, bs, body.as_of, body.months, body.fy_start_month))


@app.post("/forecast/run")
def forecast_run(body: ForecastRequest):
    return forecast(body)


class CommentaryRequest(BoardInput):
    notes: str = Field(default="", max_length=4000)
    tone: str = "board"
    length: str = "standard"
    section: str | None = None
    current: dict | None = None


@app.post("/commentary/draft")
def commentary(body: CommentaryRequest, settings: SettingsDep):
    """The board pack's commentary (or one section of it), written from a facts pack built here."""
    facts, signals = build_facts(body)
    try:
        sections = draft(
            facts,
            settings,
            signals=signals,
            notes=body.notes,
            tone=body.tone,
            length=body.length,
            section=body.section,
            current=body.current,
        )
    except CommentaryInvalid as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"sections": sections, "facts": [f.model_dump() for f in facts], "signals": signals}


class AskRequest(BoardInput):
    question: str = Field(min_length=1, max_length=500)
    notes: str = Field(default="", max_length=4000)
    history: list[dict] = []


@app.post("/commentary/ask")
def ask(body: AskRequest, settings: SettingsDep):
    facts, _ = build_facts(body)
    try:
        return {"answer": answer(facts, body.question, settings, notes=body.notes, history=body.history)}
    except CommentaryInvalid as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


class CustomerRevenueRequest(TenantRequest):
    period: str  # YYYY-MM


SALES_POSTED = {"AUTHORISED", "PAID"}


@app.post("/xero/customer-revenue")
def customer_revenue(body: CustomerRevenueRequest, settings: SettingsDep):
    """Net sales by customer for the month, the three months to it, and who bought in the two months before."""
    client = _client(settings, body)
    start = _period_add(body.period, -2)
    docs = [(d, 1) for d in client.optional_documents("Invoices", "Invoices", f"{start}-01", _month_end(body.period))]
    docs += [(d, -1) for d in client.optional_documents("CreditNotes", "CreditNotes", f"{start}-01", _month_end(body.period))]
    month: dict[str, int] = {}
    quarter: dict[str, int] = {}
    prior: set[str] = set()
    quarter_from = prior_from = start
    for doc, sign in docs:
        if doc.get("Type") not in ("ACCREC", "ACCRECCREDIT") or doc.get("Status") not in SALES_POSTED:
            continue
        name = (doc.get("Contact") or {}).get("Name") or "Unnamed customer"
        period = parse_xero_date(doc.get("DateString") or doc.get("Date"))[:7]
        cents = sign * int(round(float(doc.get("SubTotal") or 0) * 100))
        if period == body.period:
            month[name] = month.get(name, 0) + cents
        if quarter_from <= period <= body.period:
            quarter[name] = quarter.get(name, 0) + cents
        if prior_from <= period < body.period:
            prior.add(name)
    rows = lambda d: [{"contact": k, "value": v} for k, v in d.items() if v > 0]  # noqa: E731
    return _with_tokens(client, {"month": rows(month), "quarter": rows(quarter), "prior": sorted(prior)})


def _period_add(period: str, months: int) -> str:
    index = int(period[:4]) * 12 + int(period[5:7]) - 1 + months
    return f"{index // 12:04d}-{index % 12 + 1:02d}"
