"use client";

import { PeriodPicker } from "@ledgerline/ui";
import { useQuery } from "convex/react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { XeroCheck } from "@/components/app/Reconciliation";
import { BalanceSheetView } from "@/components/app/reports/BalanceSheetView";
import { api } from "@/convex/_generated/api";
import { statementCsv } from "@/lib/csv";
import { periodLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";

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
        return <BalanceSheetView snapshot={snapshot} check={<XeroCheck report="balance sheet" />} />;
      }}
    </AppPage>
  );
}

