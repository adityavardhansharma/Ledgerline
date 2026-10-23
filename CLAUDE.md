# Ledgerline

## Workflow

- Every change goes through a pull request. Never commit straight to `main`.
- For each piece of work: create a branch from an up-to-date `main`, commit, push, open a PR with `gh pr create`,
  then merge it yourself with `gh pr merge --squash --delete-branch` once typecheck and tests pass
  (`npm run typecheck` and `npm test` in `apps/web`). Afterwards, switch back to `main` and pull.
