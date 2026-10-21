# Ledgerline finance engine

A stateless FastAPI service of pure functions. Convex calls it with signed requests; it never stores anything.

| Route | Does |
| --- | --- |
| `POST /xero/authorize-url`, `/xero/token` | OAuth 2.0 with PKCE |
| `POST /xero/accounts`, `/xero/journals`, `/xero/journal-check`, `/xero/open-items` | Xero reads, returning rotated tokens when refreshed |
| `POST /reports/build` | P&L, balance sheet, cash flow, measures, cash bridge, Sankey flows, forecast defaults |
| `POST /reconcile` | Compare every account with Xero's own reports |
| `POST /forecast/run` | Three-statement forecast, runway, bands, sensitivity |
| `POST /commentary/draft` | Board-pack commentary that may only cite facts |
| `GET /health` | Liveness |

Errors map to status codes Convex acts on: `429` with `retryAfter` (rate limited), `401` with
`error: "reauth"` (the refresh token was rejected), `422` (an unbalanced journal), `500` with
`error: "integrity"` (a statement failed its own check).

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest
.venv/bin/uvicorn ledgerline_engine.api:app --reload
```
