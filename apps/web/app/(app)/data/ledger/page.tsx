"use client";

import { Amount, Button, Panel } from "@ledgerline/ui";
import { usePaginatedQuery } from "convex/react";
import { AppPage } from "@/components/app/AppPage";
import { api } from "@/convex/_generated/api";

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export default function LedgerPage() {
  const { results, status, loadMore } = usePaginatedQuery(api.ledger.journals, {}, { initialNumItems: 25 });
  return (
    <AppPage active="ledger" title="Ledger" subtitle="Every journal synced from Xero, newest first" breadcrumbs={["Data", "Ledger"]} needsData>
      {() => (
        <Panel title="Journals" icon="journal" flush>
          <div style={{ padding: "0 20px 20px" }}>
            <div className="ll-table-wrap">
              <table className="ll-table ll-ledger">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Journal</th>
                    <th scope="col">Account</th>
                    <th scope="col">Description</th>
                    <th scope="col" className="is-num">Debit</th>
                    <th scope="col" className="is-num">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {results.flatMap((j) =>
                    j.lines.map((l, i) => (
                      <tr key={`${j.id}-${i}`} style={i === 0 ? { borderTop: "1px solid var(--rule-strong)" } : undefined}>
                        <td className="ll-nowrap">{i === 0 ? fmtDate(j.date) : ""}</td>
                        <td>{i === 0 ? <span className="ll-code">JNL-{String(j.journalNumber).padStart(6, "0")}</span> : null}</td>
                        <td className="ll-nowrap"><span className="ll-fs-code">{l.code}</span> {l.account}</td>
                        <td className="ll-desc">{l.description || (i === 0 ? [j.sourceType, j.reference].filter(Boolean).join(" · ") : "")}</td>
                        <td className="is-num">{l.debitCents ? <Amount value={l.debitCents / 100} decimals={2} /> : null}</td>
                        <td className="is-num">{l.creditCents ? <Amount value={l.creditCents / 100} decimals={2} /> : null}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            <div className="ll-row" style={{ marginTop: 12 }}>
              {status === "CanLoadMore" ? <Button onClick={() => loadMore(50)}>Load 50 more journals</Button> : null}
              {status === "LoadingMore" || status === "LoadingFirstPage" ? <span className="ll-muted">Loading…</span> : null}
              {status === "Exhausted" ? <span className="ll-muted">That's every journal.</span> : null}
            </div>
          </div>
        </Panel>
      )}
    </AppPage>
  );
}
