"""HTTP surface of the finance engine. Every route is stateless; Convex holds all state."""

from __future__ import annotations

import calendar
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import __version__
from .commentary.draft import CommentaryInvalid, Fact, draft
from .forecast.model import ForecastImbalance, ForecastRequest, forecast
from .reconcile.ageing import age
from .reconcile.compare import compare
from .settings import Settings, get_settings
from .signing import verify
from .statements.build import Ledger, StatementError, build_all
from .xero.client import RateLimited, ReauthRequired, XeroClient, XeroError
from .xero.models import Tokens
from .xero.normalise import UnbalancedJournal, normalise_account, normalise_journal, normalise_open_item

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
    return {"url": XeroClient(settings).authorize_url(body.redirect_uri, body.state, body.code_challenge)}


class TokenRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str


@app.post("/xero/token")
def exchange(body: TokenRequest, settings: SettingsDep):
    client = XeroClient(settings)
    tokens = client.exchange_code(body.code, body.redirect_uri, body.code_verifier)
    return {"tokens": tokens.model_dump(), "connections": [c.model_dump() for c in client.connections()]}


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


@app.post("/reconcile")
def reconcile(body: ReconcileRequest, settings: SettingsDep):
    client = _client(settings, body)
    first = f"{body.as_of}-01"
    end = _month_end(body.as_of)
    pnl = client.profit_and_loss(first, end, body.months - 1)
    bs = client.balance_sheet(end, body.months - 1)
    ledger = Ledger.from_payload(body.accounts, body.balances)
    return _with_tokens(client, compare(ledger, pnl, bs, body.as_of, body.months))


def _month_end(period: str) -> str:
    year, month = int(period[:4]), int(period[5:7])
    return f"{period}-{calendar.monthrange(year, month)[1]:02d}"


@app.post("/forecast/run")
def forecast_run(body: ForecastRequest):
    return forecast(body)


class CommentaryRequest(BaseModel):
    facts: list[Fact]


@app.post("/commentary/draft")
def commentary(body: CommentaryRequest, settings: SettingsDep):
    try:
        return {"paragraphs": draft(body.facts, settings)}
    except CommentaryInvalid as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
