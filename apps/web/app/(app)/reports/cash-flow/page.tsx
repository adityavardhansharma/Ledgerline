"use client";

import { Button, CalendarHeatmap, FinancialStatement, KpiTile, Panel, PeriodPicker, WaterfallChart } from "@ledgerline/ui";
import { useQuery } from "convex/react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { api } from "@/convex/_generated/api";
import { euro, statementCsv, toCsv } from "@/lib/csv";
import { money, periodLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { bridgeSteps, everyDay, statementRows } from "@/lib/views";

export default function CashFlowPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const daily = useQuery(api.reports.dailyCash, snapshot ? { from: `${snapshot.series.periods.at(-6)}-01`, to: `${snapshot.asOf}-31` } : "skip");
  const net = snapshot?.measures.netProfit ?? 0;
  const change = snapshot ? snapshot.bridge.at(-1)!.value - snapshot.bridge[0].value : 0;
  return (
    <AppPage
      active="cashflow"
      title="Cash flow"
      subtitle={snapshot ? `Profit of ${money(net, { compact: true })} became a cash ${change < 0 ? "fall" : "rise"} of ${money(Math.abs(change), { compact: true })} in ${periodLabel(snapshot.asOf)}` : undefined}
      breadcrumbs={["Reports", "Cash flow"]}
      needsData
      actions={
        <>
          <PeriodPicker label={snapshot ? periodLabel(snapshot.asOf) : "Latest"} />
          <ExportMenu
            title="Cash flow"
            disabled={!snapshot}
            csv={[
              { label: "Cash flow", build: () => (snapshot ? statementCsv(snapshot.cashflow) : null) },
              { label: "Cash bridge", build: () => (snapshot ? toCsv([["Step", "Amount"], ...snapshot.bridge.map((b) => [b.label, euro(b.value)])]) : null) },
            ]}
          />
        </>
      }
    >
      {() => {
        if (!snapshot) return null;
        const operations = snapshot.cashflow.rows.find((r) => r.label === "Cash from operations")?.values ?? [];
        return (
          <>
            <Panel title={`Where ${periodLabel(snapshot.asOf)}'s cash went`} icon="cashflow">
              <WaterfallChart steps={bridgeSteps(snapshot)} height={340} />
            </Panel>
            <div className="ll-grid-2">
              <FinancialStatement title="Statement of cash flows" columns={snapshot.cashflow.columns} rows={statementRows(snapshot.cashflow) as never} drillable={false} />
              <div className="ll-stack">
                <div className="ll-kpi-strip">
                  <KpiTile icon="cashflow" tone={(operations[1] ?? 0) < 0 ? "negative" : undefined} label="Cash from operations, year to date" value={(operations[1] ?? 0) / 100} note="Profit adjusted for working capital" />
                </div>
                <div className="ll-kpi-strip">
                  <KpiTile icon="bank" label="Average monthly movement, last 3 months" value={snapshot.measures.burn / 100} note={snapshot.measures.burn < 0 ? "Net outflow" : "Net inflow"} />
                </div>
              </div>
            </div>
            <Panel title="Every day in the bank" icon="calendar" subtitle="Payroll, rent and tax days show as red stripes">
              {daily && daily.length ? <CalendarHeatmap cell={15} days={everyDay(daily, snapshot.series.periods.at(-6)!, snapshot.asOf)} /> : <p className="ll-muted">No bank movements yet.</p>}
            </Panel>
          </>
        );
      }}
    </AppPage>
  );
}
