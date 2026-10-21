# Ledgerline

**Management accounts and three-statement forecasts for small businesses, straight from Xero.**

Ledgerline reads a company's Xero ledger, builds its profit and loss, balance sheet and cash flow by month,
checks every account against Xero's own reports to the cent, and runs a driver-based three-statement
forecast with branchable scenarios, uncertainty bands and a sensitivity analysis. A board pack drafts
commentary with an LLM that is only allowed to cite figures Ledgerline computed.

```
apps/engine     Python finance engine (FastAPI): Xero I/O, statements, forecast, reconciliation, commentary
apps/web        Next.js app and landing page, with the Convex backend in apps/web/convex
packages/ui     The Ledgerline design system: tokens, 76 components and charts, 65 icons
docs            Architecture, setup and decisions
```

## What's inside

| Area | What it does |
| --- | --- |
| **Xero sync** | OAuth 2.0 with PKCE, encrypted tokens, a retryable Convex state machine (accounts → journals → invoices → reports → reconcile), one page per step, idempotent by Xero journal ID, rate-limit back-off, Demo Company reset detection, signature-checked webhooks, nightly sync |
| **Statements** | P&L, balance sheet and indirect cash flow from monthly account movements, each asserting its own integrity (the balance sheet balances, the cash flow closes to the bank) |
| **Reconciliation** | Every account compared with Xero's Profit and Loss and Balance Sheet reports, month by month |
| **Forecast** | Three statements per month from drivers (growth, margin, overheads, hires, debtor/creditor/stock days, capex, loans, equity, tax); refuses to run if assets − liabilities ≠ equity; runway, P10–P90 bands, tornado sensitivity |
| **Scenarios** | Branches that store only their changes, inherited along a parent chain like Git branches; forecasts cached by the hash of every input |
| **Board pack** | Commentary drafted through OpenRouter with structured output; a validator rejects any number that isn't a citation; a person accepts it before export |
| **App** | Overview, P&L with drill-down to journal lines, balance sheet, cash flow, forecast, scenarios, board pack, sync, ledger, audit log, team settings |
| **Landing page** | Built from live design-system components, including a working runway what-if |

## Quality

- **Engine**: 47 pytest tests, including Hypothesis property tests that generate random balanced ledgers and
  random drivers and assert every statement and every forecast month ties out. `ruff` lint and format.
- **Backend**: `convex-test` tests for organisation scoping, roles, idempotent journal storage, drill-down
  isolation, scenario inheritance, forecast caching with signed engine calls, and webhook signatures.
- **Web**: strict TypeScript across the app and Convex functions; production build in CI.

```bash
cd apps/engine && .venv/bin/pytest          # engine
cd apps/web && npx vitest run               # Convex functions and helpers
npm run typecheck                           # all TypeScript
```

## Running it locally

You need Node 20+, Python 3.12+, a free [Clerk](https://clerk.com) application, a free
[Xero developer](https://developer.xero.com) app, and optionally an [OpenRouter](https://openrouter.ai) key.
[docs/setup.md](docs/setup.md) has every step; the short version:

```bash
npm install

# 1. Finance engine
cd apps/engine
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env            # fill in LL_ENGINE_SECRET and the Xero keys
.venv/bin/uvicorn ledgerline_engine.api:app --reload --port 8000
# or: docker compose up engine

# 2. Convex backend (in another terminal)
cd apps/web
npx convex dev                  # creates a deployment and writes .env.local
npx convex env set LL_ENGINE_URL http://localhost:8000   # plus the variables in .env.example

# 3. Web app
cp .env.example .env.local      # add the Clerk keys
npm run dev
```

The landing page runs with no configuration at all; the app pages explain what's missing until Clerk and
Convex are set up. To try it without your own books, connect Xero's free Demo Company.

## Design

The interface is built from `packages/ui`, the Ledgerline design system: emerald for actuals, indigo and
hatching for forecasts, Instrument Serif for the figures that matter, Geist and Geist Mono for the rest, and
accounting conventions throughout (negatives in parentheses, double rules under totals). Screens are composed
on one sheet with hairlines rather than as loose cards.

## Architecture

See [docs/architecture.md](docs/architecture.md): system context, the sync state machine, the data model,
the forecast maths, security and testing. Key decisions are in [docs/decisions.md](docs/decisions.md).

## Licence

MIT
