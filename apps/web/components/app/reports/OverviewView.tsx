"use client";

import { BarChart, Button, formatMoney, LineChart, SankeyChart, WaterfallChart } from "@ledgerline/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { monthName, periodLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import type { ForecastRun, Snapshot } from "@/lib/types";
import { bridgeSteps, cashChart, sankeyData } from "@/lib/views";
import { pctChange, RailBlock, ReportGrid, SummaryLine } from "../report/Report";

type Bucket = { label: string; value: number };

/**
 * The morning briefing: the four figures that matter, what changed since the last sync, then cash, with what needs
 * attention beside it. Further down, where the month's cash and revenue went.
 */
export function OverviewView({ snapshot, forecast, scenarioName, isBase, receivable, assumedTerms, digest, owed, check }: { snapshot: Snapshot; forecast: ForecastRun | null | undefined; scenarioName: string; isBase: boolean; receivable: Bucket[]; assumedTerms: boolean; digest: ReactNode; owed: ReactNode; check: ReactNode }) {
  const m = snapshot.measures;
  const month = monthName(snapshot.asOf);
  const chart = cashChart(snapshot, forecast);
  const on = isBase ? "the base case" : `“${scenarioName}”`;
  const cashOut = forecast?.cashOutPeriod ? periodLabel(forecast.cashOutPeriod) : null;
  const owedTotal = receivable.reduce((n, b) => n + b.value, 0);
  const overdue = receivable.slice(1).reduce((n, b) => n + b.value, 0);
  const attention = [
    cashOut ? { tone: "bad", text: `On ${on}, cash runs out in ${cashOut}.` } : null,
    m.debtorDays !== null && m.debtorDays > 45 ? { tone: "warn", text: `Customers take ${m.debtorDays} days to pay. Collecting faster is the quickest way to more cash.` } : null,
    owedTotal && overdue / owedTotal > 0.25 ? { tone: "warn", text: `${Math.round((overdue / owedTotal) * 100)}% of what you're owed is overdue.` } : null,
    m.grossMargin !== null && m.grossMargin < 0.2 ? { tone: "warn", text: `Gross margin is ${(m.grossMargin * 100).toFixed(1)}%.` } : null,
  ].filter((x): x is { tone: string; text: string } => Boolean(x));
  const months = snapshot.series.periods.slice(-9);
  const revenue = snapshot.series.revenue.slice(-9).map((c) => c / 100);
  const forecastRevenue = forecast?.months.slice(0, 3).map((x) => x.revenue / 100) ?? [];
  return (
    <>
      <SummaryLine
        figures={[
          { label: "Cash at bank", value: formatMoney(m.cash / 100), change: m.cashDelta, changeText: m.cashDelta === null ? undefined : pctChange(m.cashDelta), good: "up", note: "on last month" },
          { label: `Revenue, ${month}`, value: formatMoney(m.revenue / 100), change: m.revenueDelta, changeText: m.revenueDelta === null ? undefined : pctChange(m.revenueDelta), good: "up", note: "on last month" },
          { label: `Net profit, ${month}`, value: formatMoney(m.netProfit / 100), change: m.netProfitDelta, changeText: m.netProfitDelta === null ? undefined : pctChange(m.netProfitDelta), good: "up", note: "on last month" },
          {
            label: "Runway",
            value: forecast ? (forecast.runwayMonths === null || !cashOut ? "24+ months" : `${forecast.runwayMonths.toFixed(1)} months`) : "–",
            note: forecast ? (cashOut ? `cash runs out in ${cashOut}` : `positive for the whole forecast, on ${on}`) : "building the forecast",
          },
        ]}
      />
      {digest}
      <ReportGrid
        main={
          <div className="ll-stack-lg">
            <section className="ll-report-hero">
              <h2>Cash at bank, and where it&apos;s heading</h2>
              <p className="ll-report-hero-sub">{forecast ? (forecast.lowestCash !== null && forecast.lowestCashPeriod ? `Lowest point ${formatMoney(forecast.lowestCash / 100)} in ${periodLabel(forecast.lowestCashPeriod)}, on ${on}.` : `On ${on}.`) : "Building the forecast…"}</p>
              <LineChart labels={chart.labels} series={chart.series as never} forecastFrom={chart.forecastFrom} todayLabel="Today" zero endLabels height={280} thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]} />
            </section>
            <section className="ll-report-hero">
              <h2>Revenue by month</h2>
              <BarChart
                labels={[...months.map((p) => periodLabel(p, false)), ...(forecast?.months.slice(0, 3).map((x) => x.label.slice(0, 3)) ?? [])]}
                values={[...revenue, ...forecastRevenue]}
                forecastFrom={forecastRevenue.length ? revenue.length : undefined}
                highlight={revenue.length - 1}
                seriesName="Revenue"
                height={260}
              />
            </section>
          </div>
        }
        rail={
          <>
            <RailBlock title="Needs your attention">
              {attention.length ? (
                <ul className="ll-attention">
                  {attention.map((a) => (
                    <li key={a.text} className={`is-${a.tone}`}>
                      {a.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ll-rail-note">Nothing stands out this month.</p>
              )}
              <Link href={ROUTES.scenarios}>
                <Button size="sm" variant="forecast" icon="branch">
                  Model a scenario
                </Button>
              </Link>
            </RailBlock>
            <RailBlock title="Owed to you" aside={owedTotal ? <b className="ll-rail-figure">{formatMoney(owedTotal / 100)}</b> : null}>
              {owedTotal ? (
                <>
                  <ul className="ll-age">
                    {receivable.map((b, i) => (
                      <li key={b.label} className={i ? "is-late" : undefined}>
                        <span>{b.label}</span>
                        <i style={{ width: `${(b.value / owedTotal) * 100}%` }} />
                        <b>{b.value ? formatMoney(b.value / 100, { compact: true }) : "–"}</b>
                      </li>
                    ))}
                  </ul>
                  {assumedTerms ? <p className="ll-rail-note">Ages assume 30-day terms.</p> : null}
                  {owed}
                </>
              ) : (
                <p className="ll-rail-note">Nobody owes you money right now.</p>
              )}
            </RailBlock>
          </>
        }
      />
      <section className="ll-report-hero">
        <h2>Where {month}&apos;s cash went</h2>
        <WaterfallChart steps={bridgeSteps(snapshot)} height={280} />
      </section>
      {snapshot.sankey.links.length ? (
        <section className="ll-report-hero">
          <h2>Where {month}&apos;s revenue went</h2>
          <p className="ll-report-hero-sub">
            {formatMoney(m.revenue / 100)} of sales, followed through every cost to {formatMoney(m.netProfit / 100)} of net profit.
          </p>
          <SankeyChart {...sankeyData(snapshot)} height={340} />
        </section>
      ) : null}
      <RailBlock title="Checked against Xero">{check}</RailBlock>
    </>
  );
}
