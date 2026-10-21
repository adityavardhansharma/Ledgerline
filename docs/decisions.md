# Decisions

| Decision | Chosen | Rejected, and why |
| --- | --- | --- |
| Where finance maths runs | A stateless Python engine of pure functions | Convex actions in TypeScript: no `Decimal`, a weaker property-testing story |
| Source of actuals | Xero's Journals endpoint | Rebuilding from invoices, bills and bank transactions: many endpoints and edge cases, and still not the ledger |
| Sync shape | One short, retryable Convex action per page | A long-running worker: serverless time limits, harder recovery |
| Idempotency | Upsert by Xero journal ID; cursor moved in the same transaction as the page | Timestamps: journals can be backdated |
| Statement reads | Snapshots per actuals version, built from monthly balances maintained on write | Recomputing from ledger lines on every view |
| Scenario storage | Overrides on a parent chain | Full copies: edits to the base wouldn't reach branches |
| Money | `int64` cents in Convex, `Decimal` in the engine, integer cents across the wire | JavaScript numbers: floating-point error on money |
| Forecast integrity | Assert assets − liabilities = equity every month and fail loudly | A balancing "plug" figure that hides mistakes |
| AI's role | Explains computed facts and must cite every number; a validator rejects anything else | Free-text summaries: unverifiable numbers in a finance product |
| Auth | Clerk Organizations with a JWT template carrying the active organisation and role | Hand-rolled multi-tenancy |
| Route protection | Checks in the server layout, plus organisation scoping in every Convex function | Path matching in the proxy, which Clerk 7 deprecates |
