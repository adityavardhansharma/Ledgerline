"use client";

import { PeriodPicker, ScenarioSwitcher, SegmentedControl } from "@ledgerline/ui";
import { useQuery } from "convex/react";
import { useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { DrillDrawer, type DrillTarget } from "@/components/app/DrillDrawer";
import { XeroCheck } from "@/components/app/Reconciliation";
import { PnlView } from "@/components/app/reports/PnlView";
import { AnomalyStrip, useAnomalies } from "@/components/app/ai/Explainers";
import { useForecast, useReportScenario } from "@/components/app/useForecast";
import { api } from "@/convex/_generated/api";
import { monthlySummaryCsv, statementCsv } from "@/lib/csv";
import { periodLabel } from "@/lib/format";
import type { Snapshot, StatementRow } from "@/lib/types";
import { pnlWithForecast } from "@/lib/views";

export default function ProfitAndLossPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const scenario = useReportScenario();
  const forecast = useForecast(scenario.selected?.id);
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const [view, setView] = useState("m");
  const anomalies = useAnomalies(Boolean(snapshot));

  return (
    <AppPage
      active="pnl"
      title="Profit and loss"
      subtitle={snapshot ? `Financial year from ${periodLabel(snapshot.fyStart)} · accrual basis · actuals to ${periodLabel(snapshot.asOf)}` : undefined}
      breadcrumbs={["Reports", "Profit and loss"]}
      needsData
      overlay={drill ? <DrillDrawer target={drill} onClose={() => setDrill(null)} /> : null}
      actions={
        <>
          <PeriodPicker label={snapshot ? `FY ${snapshot.fyStart.slice(0, 4)}` : "This year"} />
          <ScenarioSwitcher name={scenario.name} options={scenario.options} onSelect={scenario.select} />
          <SegmentedControl label="Period" value={view} onChange={setView} options={[{ value: "m", label: "Monthly" }, { value: "q", label: "Quarterly" }]} />
          <ExportMenu
            title="Profit and loss"
            disabled={!snapshot}
            csv={[
              { label: "Profit and loss", build: () => (snapshot ? statementCsv(pnlWithForecast(snapshot.pnl, forecast)) : null) },
              { label: "Monthly summary", build: () => (snapshot ? monthlySummaryCsv(snapshot) : null) },
            ]}
          />
        </>
      }
    >
      {() => {
        if (!snapshot) return null;
        const merged = pnlWithForecast(snapshot.pnl, forecast);
        const statement = view === "q" ? toQuarters(merged.columns, merged.rows) : merged;
        return (
          <PnlView
            snapshot={snapshot}
            statement={statement}
            flags={view === "m" ? anomalies.map : undefined}
            strip={<AnomalyStrip flags={anomalies.flags} />}
            check={<XeroCheck />}
            drillable={view === "m"}
            onDrill={(row: StatementRow, column: number) => {
              const period = snapshot.pnl.columns[column]?.period;
              if (!row.accountId || !period) return;
              setDrill({ accountId: row.accountId, label: row.label ?? "", code: row.code, period, value: row.values?.[column] ?? null });
            }}
          />
        );
      }}
    </AppPage>
  );
}

/** Fold twelve monthly columns (plus the year column) into four quarters. */
function toQuarters(columns: Snapshot["pnl"]["columns"], rows: ReturnType<typeof pnlWithForecast>["rows"]) {
  const quarters = [0, 1, 2, 3].map((q) => ({ label: `Q${q + 1} ${columns[q * 3]?.label.slice(-2) ?? ""}`, kind: columns.slice(q * 3, q * 3 + 3).some((c) => c.kind === "F") ? "F" : "A" }));
  const out = rows.map((row) => {
    if (!row.values) return row;
    const v = row.values;
    const values = [0, 1, 2, 3].map((q) => {
      const slice = v.slice(q * 3, q * 3 + 3).filter((x): x is number => x !== null && x !== undefined);
      return slice.length ? slice.reduce((a, b) => a + b, 0) : null;
    });
    return { ...row, values: [...values, v.at(-1) ?? null] };
  });
  const firstF = quarters.findIndex((q) => q.kind === "F");
  return { columns: [...quarters, columns.at(-1)!], rows: out, forecastFrom: firstF < 0 ? undefined : firstF };
}
