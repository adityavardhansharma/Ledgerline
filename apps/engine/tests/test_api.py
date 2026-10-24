import json
import time

import httpx
import respx
from fastapi.testclient import TestClient

from ledgerline_engine.api import app
from ledgerline_engine.settings import Settings, get_settings
from ledgerline_engine.signing import sign
from ledgerline_engine.statements.build import period_range

from .fixtures import ACCOUNTS, balances_from, month_journals, opening_journals
from .test_forecast import KESTREL


def client(unsigned=True):
    app.dependency_overrides[get_settings] = lambda: Settings(
        engine_secret="s", allow_unsigned=unsigned, xero_client_id="c", xero_client_secret="x"
    )
    get_settings.cache_clear()
    return TestClient(app)


def test_health_is_public():
    assert client(unsigned=False).get("/health").json()["ok"]


def test_unsigned_requests_are_rejected(monkeypatch):
    monkeypatch.setenv("LL_ENGINE_SECRET", "s")
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "false")
    get_settings.cache_clear()
    response = TestClient(app).post("/forecast/run", json={})
    assert response.status_code == 401


def test_api_docs_are_not_public(monkeypatch):
    monkeypatch.setenv("LL_ENGINE_SECRET", "s")
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "false")
    get_settings.cache_clear()
    assert TestClient(app).get("/docs").status_code == 401
    assert TestClient(app).get("/openapi.json").status_code == 401


def test_malformed_periods_are_refused_up_front(monkeypatch):
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    body = {"accounts": [], "balances": [], "as_of": "2026-13"}
    assert TestClient(app).post("/reports/build", json=body).status_code == 422
    assert TestClient(app).post("/reports/build", json={**body, "as_of": "Sept"}).status_code == 422
    get_settings.cache_clear()


def test_signed_requests_are_accepted(monkeypatch):
    monkeypatch.setenv("LL_ENGINE_SECRET", "s")
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "false")
    get_settings.cache_clear()
    body = json.dumps({"drivers": KESTREL.model_dump(), "horizon": 3, "bands": False, "sensitivity": False}).encode()
    ts = int(time.time())
    headers = {
        "x-ll-timestamp": str(ts),
        "x-ll-signature": sign("s", ts, "POST", "/forecast/run", body),
        "content-type": "application/json",
    }
    response = TestClient(app).post("/forecast/run", content=body, headers=headers)
    assert response.status_code == 200, response.text
    assert len(response.json()["months"]) == 3
    get_settings.cache_clear()


def test_reports_build_round_trip(monkeypatch):
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    journals = {"2025-12": opening_journals(), **{p: month_journals(p, 20_000_000) for p in period_range("2026-01", "2026-09")}}
    response = TestClient(app).post(
        "/reports/build",
        json={"accounts": ACCOUNTS, "balances": balances_from(journals), "fy_start_month": 1, "as_of": "2026-09"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["measures"]["revenue"] == 20_000_000 and body["drivers"]["startPeriod"] == "2026-10"


@respx.mock
def test_rate_limit_maps_to_429(monkeypatch):
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    respx.get("https://api.xero.com/api.xro/2.0/Journals").mock(return_value=httpx.Response(429, headers={"Retry-After": "30"}))
    tokens = {"access_token": "a", "refresh_token": "r", "expires_at": time.time() + 1800}
    response = TestClient(app).post("/xero/journals", json={"tokens": tokens, "tenant_id": "t", "offset": 0})
    assert response.status_code == 429 and response.json()["retryAfter"] == 30


@respx.mock
def test_journals_returns_next_offset_and_rotated_tokens(monkeypatch):
    monkeypatch.setenv("LL_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    respx.post("https://identity.xero.com/connect/token").mock(
        return_value=httpx.Response(200, json={"access_token": "n", "refresh_token": "r2", "expires_in": 1800})
    )
    journal = {
        "JournalID": "j1",
        "JournalNumber": 5,
        "JournalDate": "2026-09-01T00:00:00",
        "JournalLines": [{"AccountID": "a", "NetAmount": 1}, {"AccountID": "b", "NetAmount": -1}],
    }
    respx.get("https://api.xero.com/api.xro/2.0/Journals").mock(return_value=httpx.Response(200, json={"Journals": [journal]}))
    tokens = {"access_token": "a", "refresh_token": "r", "expires_at": 0}
    body = TestClient(app).post("/xero/journals", json={"tokens": tokens, "tenant_id": "t", "offset": 4}).json()
    assert body["nextOffset"] == 5 and body["fullPage"] is False
    assert body["tokens"]["refresh_token"] == "r2"
