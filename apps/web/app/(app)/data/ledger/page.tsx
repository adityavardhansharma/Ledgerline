"use client";

import { Amount, Banner, Button } from "@ledgerline/ui";
import Link from "next/link";
import { usePaginatedQuery } from "convex-helpers/react/cache";
import { useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu, useLedgerCsv } from "@/components/app/ExportMenu";
import { LedgerSearch, SearchResults } from "@/components/app/LedgerSearch";
import type { Filters } from "@/convex/search";
import { api } from "@/convex/_generated/api";
import { ROUTES } from "@/lib/nav";

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export default function LedgerPage() {
  const { results, status, loadMore } = usePaginatedQuery(api.ledger.journals, {}, { initialNumItems: 25 });
  const ledgerCsv = useLedgerCsv();
  const [filters, setFilters] = useState<Filters | null>(null);
  return (
    <AppPage
      active="ledger"
      title="Ledger"
      subtitle="Every journal, newest first"
      breadcrumbs={["Data", "Ledger"]}
      needsData
      actions={
        <ExportMenu
          title="Ledger"
          html={false}
          csv={[
            { label: "Journals", build: ledgerCsv.journals },
            { label: "Chart of accounts", build: ledgerCsv.accounts },
          ]}
        />
      }
    >
      {(workspace) => (
        <>
        {workspace.connection?.mode === "reports" && workspace.org.source !== "csv" && workspace.org.source !== "sample" ? (
          <Banner tone="info" title="Xero shares journals only with approved apps." action={<Link href={ROUTES.pnl}><Button size="sm">Open profit and loss</Button></Link>}>
            Ledgerline reads your monthly trial balances instead, so there's no journal listing here. Click any figure in a statement to see the invoices, bills,
            payments and bank transactions behind it.
          </Banner>
        ) : null}
        {workspace.connection?.mode === "reports" && workspace.org.source !== "csv" && workspace.org.source !== "sample" ? null : <LedgerSearch filters={filters} onFilters={setFilters} />}
        {filters ? (
          <section className="ll-report-hero is-flush">
            <header className="ll-section-head">
              <h2>Search results</h2>
              <span>Lines that match every filter above</span>
            </header>
            <div className="ll-pad">
              <SearchResults filters={filters} />
            </div>
          </section>
        ) : (
          <section className="ll-report-hero is-flush">
            <header className="ll-section-head">
              <h2>Journals</h2>
              <span>{results.length ? `${results.length.toLocaleString("en-IE")} shown, newest first` : "Newest first"}</span>
            </header>
            <div className="ll-journals">
              {results.map((j) => {
                const total = j.lines.reduce((n, l) => n + (l.debitCents ?? 0), 0);
                return (
                  <article key={j.id} className="ll-journal">
                    <header>
                      <time>{fmtDate(j.date)}</time>
                      <span className="ll-code">JNL-{String(j.journalNumber).padStart(6, "0")}</span>
                      <span className="ll-journal-src">{[j.sourceType, j.reference].filter(Boolean).join(" · ")}</span>
                      <Amount value={total / 100} decimals={2} />
                    </header>
                    <table>
                      <tbody>
                        {j.lines.map((l, i) => (
                          <tr key={i}>
                            <td className="ll-journal-acct">
                              <span className="ll-fs-code">{l.code}</span> {l.account}
                            </td>
                            <td className="ll-desc">{l.description}</td>
                            <td className="is-num">{l.debitCents ? <Amount value={l.debitCents / 100} decimals={2} /> : null}</td>
                            <td className="is-num">{l.creditCents ? <Amount value={l.creditCents / 100} decimals={2} /> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                );
              })}
            </div>
            <footer className="ll-journals-foot">
              {status === "CanLoadMore" ? <Button onClick={() => loadMore(50)}>Show 50 more</Button> : null}
              {status === "LoadingMore" || status === "LoadingFirstPage" ? <span className="ll-muted">Loading…</span> : null}
              {status === "Exhausted" ? <span className="ll-muted">That&apos;s every journal.</span> : null}
            </footer>
          </section>
        )}
        </>
      )}
    </AppPage>
  );
}
