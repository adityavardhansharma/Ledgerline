# Ledgerline

## Workflow

- Every change goes through a pull request. Never commit straight to `main`.
- For each piece of work: create a branch from an up-to-date `main`, commit, push, open a PR with `gh pr create`,
  then merge it yourself with `gh pr merge --merge --delete-branch` once typecheck and tests pass
  (`npm run typecheck` and `npm test` in `apps/web`). Afterwards, switch back to `main` and pull.
- Never squash. A PR's commits each land on `main`, so its history shows every step, not one commit per PR. Bring a
  branch up to date by merging `main` into it, never by rebasing, and write each commit to stand on its own.
- A PR stacked on another (its base is another PR's branch) merges through the async endpoint:
  `gh api -X PUT repos/{owner}/{repo}/pulls/{n}/merge-async -f merge_method=merge -f merge_action=direct_merge`.

## Deploys

- Merging to `main` deploys production: Vercel's production build runs `npx convex deploy --cmd 'npm run build'`
  (see `apps/web/vercel.json`), so Convex functions and the frontend ship together. Preview builds only build the
  frontend. The `CONVEX_DEPLOY_KEY` it uses is a Production-only secret in Vercel.
- Vouchers live in the `vouchers` table; create or change one with
  `npx convex run billing:setVoucher '{"code":"…","limits":{"actions":40,"chats":80}}'` (add `--prod` for production).
