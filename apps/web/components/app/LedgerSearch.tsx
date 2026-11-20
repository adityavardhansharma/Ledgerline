"use client";

import { AiOrb, Amount, Button, Icon, Skeleton } from "@ledgerline/ui";
import { useAction } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Filters } from "@/convex/search";
import { errorText } from "./BoardCommentary";

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const euro = (cents: number) => (cents / 100).toLocaleString("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EMPTY: Filters = { accounts: [], contact: "", words: "", dateFrom: "", dateTo: "", minCents: null, maxCents: null, side: "any" };
const isEmpty = (f: Filters) => !f.accounts.length && !f.contact && !f.words && !f.dateFrom && !f.dateTo && f.minCents === null && f.maxCents === null && f.side === "any";

const EXAMPLES = ["Payments to Liffey Timber over 5k this year", "Marketing in Q2", "Receipts from Glenmore Developments"];

/**
 * Search the ledger in plain words. The words become filters, shown as chips that can be removed one by one;
 * the matching is an ordinary query, so the results are exact.
 */
export function LedgerSearch({ filters, onFilters }: { filters: Filters | null; onFilters: (f: Filters | null) => void }) {
  const parse = useAction(api.search.parse);
  const chart = useQuery(api.ledger.chart, {});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = new Map((chart ?? []).map((a) => [a.code, a.name]));

  const run = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const f = await parse({ text: q });
      onFilters(isEmpty(f) ? null : f);
      if (isEmpty(f)) setError("Couldn't turn that into a search. Name an account, a customer or supplier, a period or an amount.");
    } catch (err) {
      setError(errorText(err, "Search didn't work. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const drop = (patch: Partial<Filters>) => {
    if (!filters) return;
    const next = { ...filters, ...patch };
    onFilters(isEmpty(next) ? null : next);
  };

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (filters) {
    for (const code of filters.accounts) chips.push({ key: `a${code}`, label: `${code} ${names.get(code) ?? ""}`.trim(), remove: () => drop({ accounts: filters.accounts.filter((c) => c !== code) }) });
    if (filters.contact) chips.push({ key: "c", label: filters.contact, remove: () => drop({ contact: "" }) });
    if (filters.dateFrom || filters.dateTo)
      chips.push({ key: "d", label: `${filters.dateFrom ? fmtDate(filters.dateFrom) : "Start"} – ${filters.dateTo ? fmtDate(filters.dateTo) : "today"}`, remove: () => drop({ dateFrom: "", dateTo: "" }) });
    if (filters.minCents !== null) chips.push({ key: "min", label: `Over ${euro(filters.minCents)}`, remove: () => drop({ minCents: null }) });
    if (filters.maxCents !== null) chips.push({ key: "max", label: `Under ${euro(filters.maxCents)}`, remove: () => drop({ maxCents: null }) });
    if (filters.side !== "any") chips.push({ key: "s", label: filters.side === "debit" ? "Debits only" : "Credits only", remove: () => drop({ side: "any" }) });
    if (filters.words) chips.push({ key: "w", label: `“${filters.words}”`, remove: () => drop({ words: "" }) });
  }

  return (
    <div className="ll-lsearch">
      <form
        className="ll-lsearch-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void run(text);
        }}
      >
        <Icon name="search" size={18} />
        <input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Search in your own words: payments to Liffey Timber over 5k in Q2" aria-label="Search the ledger" />
        {busy ? <span className="ll-lsearch-busy"><AiOrb size={14} busy />Reading…</span> : null}
        <Button type="submit" size="sm" variant="primary" disabled={!text.trim() || busy}>
          Search
        </Button>
      </form>
      {chips.length ? (
        <div className="ll-lsearch-chips">
          {chips.map((c) => (
            <span key={c.key} className="ll-lsearch-chip">
              {c.label}
              <button type="button" aria-label={`Remove ${c.label}`} onClick={c.remove}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="ll-lsearch-clear"
            onClick={() => {
              onFilters(null);
              setText("");
            }}
          >
            Clear search
          </button>
        </div>
      ) : !filters ? (
        <div className="ll-lsearch-examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                void run(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="ll-ai-error">{error}</p> : null}
    </div>
  );
}

export function SearchResults({ filters }: { filters: Filters }) {
  const result = useQuery(api.search.results, { filters: { ...EMPTY, ...filters } });
  if (result === undefined) return <Skeleton lines={6} />;
  if (!result || !result.count) return <p className="ll-muted">No journal lines match. Remove a filter above to widen the search.</p>;
  return (
    <>
      <div className="ll-table-wrap">
        <table className="ll-table ll-ledger">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Journal</th>
              <th scope="col">Account</th>
              <th scope="col">Contact</th>
              <th scope="col">Description</th>
              <th scope="col" className="is-num">Debit</th>
              <th scope="col" className="is-num">Credit</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.id}>
                <td className="ll-nowrap">{fmtDate(r.date)}</td>
                <td><span className="ll-code">JNL-{String(r.journalNumber).padStart(6, "0")}</span></td>
                <td className="ll-nowrap"><span className="ll-fs-code">{r.code}</span> {r.account}</td>
                <td className="ll-nowrap">{r.contact}</td>
                <td className="ll-desc">{r.description}</td>
                <td className="is-num">{r.debitCents ? <Amount value={r.debitCents / 100} decimals={2} /> : null}</td>
                <td className="is-num">{r.creditCents ? <Amount value={r.creditCents / 100} decimals={2} /> : null}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}>
                {result.count.toLocaleString("en-IE")} line{result.count === 1 ? "" : "s"}
                {result.more ? ", newest 300 shown" : ""}
                {result.capped ? " · search covers the most recent lines; narrow the dates to look further back" : ""}
              </td>
              <td className="is-num"><Amount value={result.debitCents / 100} decimals={2} /></td>
              <td className="is-num"><Amount value={result.creditCents / 100} decimals={2} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
