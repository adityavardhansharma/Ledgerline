"use client";

import { Button, PeriodPicker, ScenarioSwitcher } from "@ledgerline/ui";
import { useQuery } from "convex/react";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { forecastCsv, monthlySummaryCsv } from "@/lib/csv";
import { Reconciliation } from "@/components/app/Reconciliation";
import { useForecast, useReportScenario } from "@/components/app/useForecast";
import { api } from "@/convex/_generated/api";
import { periodLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import { ChangeDigest } from "@/components/app/ai/Explainers";
import { OwedList } from "@/components/app/ai/Reminder";
import type { Snapshot } from "@/lib/types";
import { OverviewView } from "@/components/app/reports/OverviewView";
import { everyDay } from "@/lib/views";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const ageing = useQuery(api.reports.ageing);
  const scenario = useReportScenario();
  const forecast = useForecast(scenario.selected?.id, snapshot?.version);
  const daily = useQuery(api.reports.dailyCash, snapshot ? { from: `${snapshot.series.periods.at(-6)}-01`, to: `${snapshot.asOf}-31` } : "skip");

  return (
    <AppPage
      active="overview"
      title={greeting()}
      subtitle={snapshot ? `Figures to the end of ${periodLabel(snapshot.asOf)}` : undefined}
      breadcrumbs={["Overview"]}
      needsData
      actions={
        <>
          <PeriodPicker label={snapshot ? periodLabel(snapshot.asOf) : "Latest month"} />
          <ScenarioSwitcher name={scenario.name} options={scenario.options} onSelect={scenario.select} />
          <ExportMenu
            title="Overview"
            disabled={!snapshot}
            csv={[
              { label: "Monthly summary", build: () => (snapshot ? monthlySummaryCsv(snapshot) : null) },
              { label: `${scenario.name} forecast`, build: () => (forecast ? forecastCsv(forecast, scenario.name) : null) },
            ]}
          />
          <Link href={ROUTES.boardpack}>
            <Button icon="boardpack" variant="primary">Board pack</Button>
          </Link>
        </>
      }
    >
      {() => {
        if (!snapshot) return null;
        return (
          <OverviewView
            snapshot={snapshot}
            forecast={forecast}
            scenarioName={scenario.name}
            isBase={scenario.selected?.isBase !== false}
            receivable={(ageing?.receivable ?? []) as { label: string; value: number }[]}
            assumedTerms={(ageing as { source?: string } | null)?.source === "journals"}
            digest={<ChangeDigest />}
            owed={<OwedList top={((ageing?.receivableTop ?? []) as { contact: string; value: number }[]).slice(0, 3)} />}
            check={<Reconciliation />}
            days={daily ? everyDay(daily, snapshot.series.periods.at(-6)!, snapshot.asOf).map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" }) })) : null}
          />
        );
      }}
    </AppPage>
  );
}
