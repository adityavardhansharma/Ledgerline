"use client";

import { BalanceBars, BulletChart, Button, FinancialStatement, Panel, PeriodPicker } from "@ledgerline/ui";
import { useQuery } from "convex/react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { Reconciliation } from "@/components/app/Reconciliation";
import { api } from "@/convex/_generated/api";
import { statementCsv } from "@/lib/csv";
import { money, periodLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { statementRows } from "@/lib/views";

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

export default function BalanceSheetPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  return (
    <AppPage
      active="balance"
      title="Balance sheet"
      subtitle={snapshot ? `As at the end of ${periodLabel(snapshot.asOf)}, compared with the last year end` : undefined}
      breadcrumbs={["Reports", "Balance sheet"]}
      needsData
      actions={
        <>
          <PeriodPicker label={snapshot ? `As at ${periodLabel(snapshot.asOf)}` : "Latest"} />
          <ExportMenu title="Balance sheet" disabled={!snapshot} csv={[{ label: "Balance sheet", build: () => (snapshot ? statementCsv(snapshot.balance) : null) }]} />
        </>
      }
    >
      {() => {
        if (!snapshot) return null;
        const m = snapshot.measures;
        const totalAssets = snapshot.balance.totalAssets.at(-1) ?? 0;
        const sides = bars(snapshot);
        const sum = (items: { value: number }[]) => items.reduce((n, i) => n + i.value, 0);
        const balanced = Math.abs(sum(sides.assets) - sum(sides.liabilities) - sum(sides.equity)) < 0.5;
        const target = (label: string, actual: number | null, goal: number, max: number, invert: boolean, unit: string) =>
          actual === null ? null : { label, actual, target: goal, max, bands: [goal * 0.8, goal * 1.25, max], invert, format: (v: number) => `${v}${unit}` };
        const bullets = [
          target("Debtor days", m.debtorDays, 35, 90, true, " days"),
          target("Creditor days", m.creditorDays, 30, 90, false, " days"),
          m.currentRatio === null ? null : { label: "Current ratio", actual: m.currentRatio, target: 1.5, max: Math.max(3, m.currentRatio * 1.2), bands: [1, 1.5, 3], format: (v: number) => `${v.toFixed(2)}×` },
        ].filter(Boolean);
        return (
          <>
            <div className="ll-grid-2r">
              <div className="ll-stack">
                <Panel title={balanced ? "It balances" : "It doesn't balance"} icon="balance" subtitle={balanced ? `${money(totalAssets)} on each side` : "See the reconciliation below"}>
                  <BalanceBars {...sides} />
                </Panel>
                <Panel title="Working capital against target" icon="invoice">
                  <BulletChart rows={bullets as never} />
                </Panel>
              </div>
              <FinancialStatement title="Account" columns={snapshot.balance.columns} rows={statementRows(snapshot.balance) as never} drillable={false} />
            </div>
            <Reconciliation report="balance sheet" />
          </>
        );
      }}
    </AppPage>
  );
}
