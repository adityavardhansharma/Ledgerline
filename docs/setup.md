# Setting up Ledgerline

## 1. Clerk

1. Create an application at <https://dashboard.clerk.com> and turn on **Organizations**.
2. Add a custom role `org:accountant` (read and comment) if you want accountant access.
3. Create a **JWT template** named `convex` with these claims:

   ```json
   { "org_id": "{{org.id}}", "org_role": "{{org.role}}", "org_name": "{{org.name}}" }
   ```

4. Copy the template's **issuer** URL; Convex needs it as `CLERK_JWT_ISSUER_DOMAIN`.
5. Put `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `apps/web/.env.local`.

## 2. Convex

```bash
cd apps/web
npx convex dev
```

This creates a deployment, writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`, pushes the functions and keeps
them in sync. Then set the server-side variables:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
npx convex env set LL_ENGINE_URL http://localhost:8000
npx convex env set LL_ENGINE_SECRET "$(openssl rand -hex 32)"     # the same value goes in the engine's .env
npx convex env set LL_TOKEN_KEY "$(openssl rand -base64 32)"      # encrypts Xero tokens at rest
npx convex env set SITE_URL http://localhost:3000
npx convex env set XERO_WEBHOOK_KEY your-webhook-key               # from step 3
```

`LL_ENGINE_URL` must be reachable from Convex. With Convex Cloud and the engine on your laptop, expose it with
a tunnel (for example `cloudflared tunnel --url http://localhost:8000`) or run Convex locally with
`npx convex dev --local`.

## 3. Xero

1. Create a **Web app** at <https://developer.xero.com/app/manage>. Ledgerline requests the granular scopes
   `accounting.settings.read`, `accounting.journals.read`, `accounting.invoices.read`,
   `accounting.reports.profitandloss.read` and `accounting.reports.balancesheet.read`. Xero may not grant
   `accounting.journals.read` to new apps; if authorisation fails with `invalid_scope`, ask Xero for journals access.
2. Redirect URI: `https://<your-deployment>.convex.site/xero/callback` (the Convex HTTP actions URL).
3. Put the client ID and secret in `apps/engine/.env` as `LL_XERO_CLIENT_ID` and `LL_XERO_CLIENT_SECRET`.
4. Optional: under **Webhooks**, subscribe to Invoices and Contacts with the delivery URL
   `https://<your-deployment>.convex.site/xero/webhook`, and copy the webhook key into `XERO_WEBHOOK_KEY`.
5. To test without real books, connect Xero's **Demo Company** when Ledgerline sends you to Xero.

## 4. Finance engine

```bash
cd apps/engine
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp .env.example .env
.venv/bin/uvicorn ledgerline_engine.api:app --reload --port 8000
```

Or `docker compose up engine` from the repository root. `LL_OPENROUTER_API_KEY` is optional; without it the
board pack explains that commentary isn't configured.

## 5. Web app

```bash
npm run dev     # from the repository root
```

Open <http://localhost:3000>, create an account and an organisation, and connect Xero.
