"use client";

import { BulletChart, FinancialStatement, formatMoney } from "@ledgerline/ui";
import type { ReactNode } from "react";
import { money } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { statementRows } from "@/lib/views";
import { moneyChange, OwnOwe, RailBlock, ReportGrid, SummaryLine, Takeaway } from "../report/Report";

const ASSET_SWATCH = [1, 4, 6, 3, 2, 5];
const CLAIM_SWATCH = [5, 2, 3, 6, 4];

/** Turn the balance sheet's lines into the two columns of BalanceBars (current period only). */
function bars(snapshot: Snapshot) {
  const rows = snapshot.balance.rows;
  const section = (name: string) => {
    const start = rows.findIndex((r) => r.type === "section" && r.label === name);
    const out = [];
    for (let i = start + 1; i < rows.length && rows[i].type === "line"; i++) out.push(rows[i]);
    return out;
  };
  const current = (r: (typeof rows)[number]) => (r.values?.at(-1) ?? 0) / 100;
  // Contra lines (depreciation on an asset, a debit on a liability) come straight after the line they reduce:
  // net them into it, so each side adds up to the balance sheet's own total.
  const netted = (lines: { label: string; value: number }[]) => {
    const out: { label: string; value: number }[] = [];
    for (const line of lines) {
      const last = out.at(-1);
      if (line.value < 0 && last) out[out.length - 1] = { label: `${last.label} (net)`, value: last.value + line.value };
      else out.push({ ...line });
    }
    return out.filter((l) => Math.abs(l.value) >= 0.5);
  };
  const assets = netted(section("Assets").map((r) => ({ label: r.label ?? "", value: current(r) }))).map((a, i) => ({ ...a, swatch: ASSET_SWATCH[i % 6] }));
  const liabilities = netted(section("Liabilities").map((r) => ({ label: r.label ?? "", value: -current(r) }))).map((a, i) => ({ ...a, swatch: CLAIM_SWATCH[i % 5] }));
  const equityTotal = (rows.find((r) => r.label === "Total equity")?.values?.at(-1) ?? 0) / 100;
  return { assets, liabilities, equity: [{ label: "Equity", value: equityTotal, swatch: 1, group: "equity" as const }] };
}

/** The balance sheet: headline figures, what moved since the year end, the statement, and a rail of checks. */
export function BalanceSheetView({ snapshot, check }: { snapshot: Snapshot; check: ReactNode }) {
      const m = snapshot.measures;
      const sides = bars(snapshot);
      const sum = (items: { value: number }[]) => items.reduce((n, i) => n + i.value, 0);
      const balanced = Math.abs(sum(sides.assets) - sum(sides.liabilities) - sum(sides.equity)) < 0.5;
      const rows = snapshot.balance.rows;
      const pair = (label: string) => {
        const v = rows.find((r) => r.label === label)?.values ?? [];
        return [(v[0] ?? 0) / 100, (v.at(-1) ?? 0) / 100] as const;
      };
      const [naStart, naNow] = pair("Net assets");
      const [taStart, taNow] = pair("Total assets");
      const [tlStart, tlNow] = pair("Total liabilities");
      const since = snapshot.balance.columns[0]?.label ?? "the year end";
      const target = (label: string, actual: number | null, goal: number, max: number, invert: boolean, unit: string) =>
        actual === null ? null : { label, actual, target: goal, max, bands: [goal * 0.8, goal * 1.25, max], invert, format: (v: number) => `${v}${unit}` };
      const bullets = [
        target("Debtor days", m.debtorDays, 35, 90, true, " days"),
        target("Creditor days", m.creditorDays, 30, 90, false, " days"),
        m.currentRatio === null ? null : { label: "Current ratio", actual: m.currentRatio, target: 1.5, max: Math.max(3, m.currentRatio * 1.2), bands: [1, 1.5, 3], format: (v: number) => `${v.toFixed(2)}×` },
      ].filter(Boolean);
      const statement = withChange(snapshot);
      return (
        <>
          <SummaryLine
            figures={[
              { label: "Net assets", value: formatMoney(naNow), change: naNow - naStart, changeText: moneyChange(naNow - naStart), good: "up", note: `since ${since}` },
              { label: "Total assets", value: formatMoney(taNow), change: taNow - taStart, changeText: moneyChange(taNow - taStart), note: `since ${since}` },
              { label: "Total liabilities", value: formatMoney(-tlNow), change: tlStart - tlNow, changeText: moneyChange(tlStart - tlNow), good: "down", note: `since ${since}` },
              { label: "Current ratio", value: m.currentRatio === null ? "–" : `${m.currentRatio.toFixed(2)}×`, note: "Target 1.5× or more" },
            ]}
          />
          <Takeaway>{takeaway(snapshot, naNow - naStart, since)}</Takeaway>
          <ReportGrid
            main={<FinancialStatement title="Account" columns={statement.columns} rows={statement.rows as never} totalColumn drillable={false} />}
            rail={
              <>
                <div className={`ll-balance-check${balanced ? "" : " is-bad"}`}>
                  <span aria-hidden>{balanced ? "=" : "≠"}</span>
                  <div>
                    <b>{balanced ? "It balances" : "It doesn't balance"}</b>
                    <small>{balanced ? `${money(snapshot.balance.totalAssets.at(-1) ?? 0)} on each side` : "See the check against Xero below"}</small>
                  </div>
                </div>
                <RailBlock title="What it owns and owes">
                  <OwnOwe assets={sides.assets} claims={[...sides.liabilities, ...sides.equity]} />
                </RailBlock>
                <RailBlock title="Working capital against target">
                  <BulletChart rows={bullets as never} />
                </RailBlock>
                <RailBlock title="Checked against Xero">
                  {check}
                </RailBlock>
              </>
            }
          />
        </>
      );
}

/** The statement with a third column: the change since the first column (the last year end). */
function withChange(snapshot: Snapshot) {
  const rows = statementRows(snapshot.balance).map((row) => {
    if (!row.values) return row;
    const first = row.values[0];
    const last = row.values.at(-1);
    return { ...row, values: [...row.values, first == null && last == null ? null : (last ?? 0) - (first ?? 0)] };
  });
  return { columns: [...snapshot.balance.columns, { label: "Change" }], rows };
}

/** "Net assets rose €X since Dec 25 close. The biggest moves: …", from the accounts that moved most. */
function takeaway(snapshot: Snapshot, netChange: number, since: string) {
  const rows = snapshot.balance.rows;
  const moves: { label: string; change: number }[] = [];
  let section = "";
  for (const row of rows) {
    if (row.type === "section") section = row.label ?? "";
    if (row.type !== "line" || !row.values || (section !== "Assets" && section !== "Liabilities")) continue;
    const delta = ((row.values.at(-1) ?? 0) - (row.values[0] ?? 0)) / 100;
    // Liabilities are held negative: owing more is a rise.
    moves.push({ label: row.label ?? "", change: section === "Liabilities" ? -delta : delta });
  }
  const top = moves.filter((x) => Math.abs(x.change) >= 1).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);
  const phrase = (x: { label: string; change: number }) => `${lower(x.label)} ${x.change > 0 ? "up" : "down"} ${formatMoney(Math.abs(x.change), { compact: true })}`;
  const list = top.length > 1 ? `${top.slice(0, -1).map(phrase).join(", ")} and ${phrase(top.at(-1)!)}` : top.map(phrase).join("");
  const head = Math.abs(netChange) < 1 ? `Net assets are where they were at ${since}.` : `Net assets ${netChange > 0 ? "rose" : "fell"} ${formatMoney(Math.abs(netChange), { compact: true })} since ${since}.`;
  return top.length ? `${head} The biggest moves: ${list}.` : head;
}

/** Lower-case the first letter for use mid-sentence, leaving acronyms such as VAT alone. */
function lower(label: string) {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}
