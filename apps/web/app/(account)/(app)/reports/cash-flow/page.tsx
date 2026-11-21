"use client";

import { PeriodPicker } from "@ledgerline/ui";
import { useQuery } from "convex-helpers/react/cache";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { CashFlowView } from "@/components/app/reports/CashFlowView";
import { api } from "@/convex/_generated/api";
import { euro, statementCsv, toCsv } from "@/lib/csv";
import { periodLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { everyDay } from "@/lib/views";

export default function CashFlowPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const daily = useQuery(api.reports.dailyCash, snapshot ? { from: `${snapshot.series.periods.at(-6)}-01`, to: `${snapshot.asOf}-31` } : "skip");
  return (
    <AppPage
      active="cashflow"
      title="Cash flow"
      subtitle={snapshot ? `${periodLabel(snapshot.asOf)}, with the financial year to date` : undefined}
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
        return <CashFlowView snapshot={snapshot} days={daily ? everyDay(daily, snapshot.series.periods.at(-6)!, snapshot.asOf) : null} />;
      }}
    </AppPage>
  );
}
