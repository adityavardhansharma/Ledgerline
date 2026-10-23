# Ledgerline

## Workflow

- Every change goes through a pull request. Never commit straight to `main`.
- For each piece of work: create a branch from an up-to-date `main`, commit, push, open a PR with `gh pr create`,
  then merge it yourself with `gh pr merge --squash --delete-branch` once typecheck and tests pass
  (`npm run typecheck` and `npm test` in `apps/web`). Afterwards, switch back to `main` and pull.

## Deploys

- Merging to `main` deploys production: Vercel's production build runs `npx convex deploy --cmd 'npm run build'`
  (see `apps/web/vercel.json`), so Convex functions and the frontend ship together. Preview builds only build the
  frontend. The `CONVEX_DEPLOY_KEY` it uses is a Production-only secret in Vercel.
- Vouchers live in the `vouchers` table; create or change one with
  `npx convex run billing:setVoucher '{"code":"…","limits":{"actions":40,"chats":80}}'` (add `--prod` for production).
