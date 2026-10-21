"use client";

import {
  Banner,
  BarChart,
  Button,
  CalendarHeatmap,
  DonutChart,
  HeroMetric,
  KpiTile,
  LineChart,
  Panel,
  PeriodPicker,
  RunwayGauge,
  SankeyChart,
  ScenarioSwitcher,
  WaterfallChart,
} from "@ledgerline/ui";
import { useQuery } from "convex/react";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { forecastCsv, monthlySummaryCsv } from "@/lib/csv";
import { Reconciliation } from "@/components/app/Reconciliation";
import { useForecast, useReportScenario } from "@/components/app/useForecast";
import { api } from "@/convex/_generated/api";
import { money, periodLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import type { Snapshot } from "@/lib/types";
import { bridgeSteps, cashChart, everyDay, sankeyData } from "@/lib/views";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const ageing = useQuery(api.reports.ageing);
  const scenario = useReportScenario();
  const forecast = useForecast(scenario.selected?.id, snapshot?.version);
  const from = snapshot ? `${snapshot.series.periods.at(-6)}-01` : "";
  const to = snapshot ? `${snapshot.asOf}-31` : "";
  const daily = useQuery(api.reports.dailyCash, snapshot ? { from, to } : "skip");

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
        const m = snapshot.measures;
        const chart = cashChart(snapshot, forecast);
        const runway = forecast?.runwayMonths ?? null;
        const cashOut = forecast?.cashOutPeriod ? periodLabel(forecast.cashOutPeriod) : null;
        const months = snapshot.series.periods.slice(-9);
        const revenue = snapshot.series.revenue.slice(-9).map((c) => c / 100);
        const forecastRevenue = forecast?.months.slice(0, 3).map((x) => x.revenue / 100) ?? [];
        const receivables = (ageing?.receivable ?? []) as { label: string; value: number }[];
        const overdueShare = receivables.length
          ? receivables.slice(1).reduce((s, b) => s + b.value, 0) / Math.max(1, receivables.reduce((s, b) => s + b.value, 0))
          : null;
        return (
          <>
            <div className="ll-grid-2 ll-stretch">
              <HeroMetric
                icon="bank"
                label={`Cash at bank · ${periodLabel(snapshot.asOf)}`}
                value={m.cash / 100}
                delta={m.cashDelta ?? undefined}
                deltaLabel="vs previous month"
                meta={cashOut ? `On ${scenario.selected?.isBase === false ? `“${scenario.name}”` : "the base case"}, cash runs out in ${cashOut}` : forecast ? `On ${scenario.selected?.isBase === false ? `“${scenario.name}”` : "the base case"}, cash stays positive for the next two years` : "Building the forecast"}
              >
                <LineChart labels={chart.labels} series={chart.series as never} forecastFrom={chart.forecastFrom} todayLabel="Today" zero endLabels height={250} thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]} />
              </HeroMetric>
              <Panel title="Runway" icon="runway" subtitle={m.burn < 0 ? `${scenario.name}, at ${money(-m.burn, { compact: true })} net outflow a month` : "Cash has been growing on average"}>
                <div className="ll-stack" style={{ alignItems: "center" }}>
                  {runway !== null ? <RunwayGauge months={runway} cashOut={cashOut ?? undefined} size={250} /> : <RunwayGauge months={24} size={250} />}
                  {m.debtorDays !== null && m.debtorDays > 45 ? (
                    <Banner tone="warning" title="Customers are paying slowly.">Debtor days are {m.debtorDays}. Collecting faster is the quickest way to lengthen runway.</Banner>
                  ) : null}
                  <Link href={ROUTES.scenarios} style={{ width: "100%" }}>
                    <Button variant="forecast" icon="branch" block>Model a scenario</Button>
                  </Link>
                </div>
              </Panel>
            </div>

            <div className="ll-kpi-strip">
              <KpiTile icon="euro" label={`Revenue, ${periodLabel(snapshot.asOf)}`} value={m.revenue / 100} delta={m.revenueDelta ?? undefined} deltaLabel="vs previous month" spark={snapshot.series.revenue.slice(-9).map((c) => c / 100)} />
              <KpiTile icon="trend-up" label={`Net profit, ${periodLabel(snapshot.asOf)}`} value={m.netProfit / 100} delta={m.netProfitDelta ?? undefined} deltaLabel="vs previous month" spark={snapshot.series.netProfit.slice(-9).map((c) => c / 100)} />
              <KpiTile icon="percent" label="Gross margin" value={m.grossMargin} format="pct" note="Gross profit ÷ revenue" />
              <KpiTile icon="invoice" tone={m.debtorDays !== null && m.debtorDays > 45 ? "warning" : undefined} label="Debtor days" value={m.debtorDays} format="days" note="Debtors ÷ last 3 months' sales" />
              <KpiTile icon="balance" label="Current ratio" value={m.currentRatio} format="ratio" note="Current assets ÷ current liabilities" />
            </div>

            {snapshot.sankey.links.length ? (
              <Panel title={`Where ${periodLabel(snapshot.asOf)}'s revenue went`} icon="statement" subtitle={`${money(m.revenue)} of sales, followed through every cost to ${money(m.netProfit)} of net profit`}>
                <SankeyChart {...sankeyData(snapshot)} height={380} />
              </Panel>
            ) : null}

            <div className="ll-grid-2">
              <Panel title="Daily cash movement" icon="calendar" subtitle="Money in and out of the bank over the last six months">
                {daily && daily.length ? (
                  <CalendarHeatmap
                    cell={17}
                    days={everyDay(daily, snapshot.series.periods.at(-6)!, snapshot.asOf).map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" }) }))}
                  />
                ) : (
                  <p className="ll-muted">No bank movements yet.</p>
                )}
              </Panel>
              <Panel title="Owed to you" icon="invoice" subtitle={overdueShare !== null ? `Trade debtors by age · ${Math.round(overdueShare * 100)}% is overdue` : "Trade debtors by age"}>
                {receivables.some((b) => b.value) ? (
                  <DonutChart size={176} thickness={16} centerLabel="Owed to you" items={receivables.map((b, i) => ({ label: b.label, value: b.value / 100, swatch: [1, 4, 3, 5, 5][i] }))} />
                ) : (
                  <p className="ll-muted">Nobody owes you money right now.</p>
                )}
              </Panel>
            </div>

            <div className="ll-grid-halves">
              <Panel title={`Where ${periodLabel(snapshot.asOf)}'s cash went`} icon="cashflow">
                <WaterfallChart steps={bridgeSteps(snapshot)} height={300} />
              </Panel>
              <Panel title="Revenue by month" icon="trend-up">
                <BarChart
                  labels={[...months.map((p) => periodLabel(p, false)), ...(forecast?.months.slice(0, 3).map((x) => x.label.slice(0, 3)) ?? [])]}
                  values={[...revenue, ...forecastRevenue]}
                  forecastFrom={forecastRevenue.length ? revenue.length : undefined}
                  highlight={revenue.length - 1}
                  seriesName="Revenue"
                  height={300}
                />
              </Panel>
            </div>
            <Reconciliation />
          </>
        );
      }}
    </AppPage>
  );
}
