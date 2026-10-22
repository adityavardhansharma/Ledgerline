"use client";

import { BarChart, FinancialStatement, formatMoney, Treemap } from "@ledgerline/ui";
import type { ReactNode } from "react";
import { monthName } from "@/lib/format";
import type { Snapshot, StatementRow } from "@/lib/types";
import { opexItems } from "@/lib/views";
import { pctChange, RailBlock, SummaryLine, Takeaway } from "../report/Report";

type Shown = { columns: Snapshot["pnl"]["columns"]; rows: unknown[]; forecastFrom?: number };

/** The year so far against the same months last year, from the monthly series (cents). */
function yearToDate(snapshot: Snapshot, key: "revenue" | "grossProfit" | "ebitda" | "netProfit") {
  const { periods } = snapshot.series;
  const values = snapshot.series[key];
  const lastYear = (p: string) => `${Number(p.slice(0, 4)) - 1}${p.slice(4)}`;
  let now = 0;
  let before: number | null = 0;
  periods.forEach((p, i) => {
    if (p < snapshot.fyStart || p > snapshot.asOf) return;
    now += values[i];
    const j = periods.indexOf(lastYear(p));
    if (j < 0) before = null;
    else if (before !== null) before += values[j];
  });
  return { now: now / 100, before: before === null ? null : before / 100 };
}

const change = (now: number, before: number | null) => (before ? (now - before) / Math.abs(before) : null);

/** Profit and loss: the year so far, what moved this month, the statement, and where the costs go. */
export function PnlView({ snapshot, statement, flags, strip, check, drillable, onDrill }: { snapshot: Snapshot; statement: Shown; flags?: Record<string, { text: string }>; strip?: ReactNode; check: ReactNode; drillable: boolean; onDrill: (row: StatementRow, column: number) => void }) {
  const revenue = yearToDate(snapshot, "revenue");
  const gross = yearToDate(snapshot, "grossProfit");
  const ebitda = yearToDate(snapshot, "ebitda");
  const net = yearToDate(snapshot, "netProfit");
  const margin = revenue.now ? gross.now / revenue.now : null;
  const marginBefore = revenue.before && gross.before !== null ? gross.before / revenue.before : null;
  const vsLastYear = (now: number, before: number | null, good: "up" | "down" = "up") => {
    const c = change(now, before);
    return { change: c, changeText: c === null ? undefined : pctChange(c), good, note: c === null ? "year to date" : "on last year" };
  };
  const opex = opexItems(snapshot);
  return (
    <>
      <SummaryLine
        figures={[
          { label: "Revenue, year to date", value: formatMoney(revenue.now), ...vsLastYear(revenue.now, revenue.before) },
          {
            label: "Gross margin",
            value: margin === null ? "–" : `${(margin * 100).toFixed(1)}%`,
            change: margin !== null && marginBefore !== null ? margin - marginBefore : null,
            changeText: margin !== null && marginBefore !== null ? `${margin >= marginBefore ? "+" : "−"}${Math.abs((margin - marginBefore) * 100).toFixed(1)} pts` : undefined,
            good: "up",
            note: marginBefore === null ? "year to date" : "on last year",
          },
          { label: "EBITDA, year to date", value: formatMoney(ebitda.now), ...vsLastYear(ebitda.now, ebitda.before) },
          { label: "Net profit, year to date", value: formatMoney(net.now), ...vsLastYear(net.now, net.before) },
        ]}
      />
      <Takeaway>{takeaway(snapshot)}</Takeaway>
      {strip}
      <FinancialStatement title="Account" flags={flags} columns={statement.columns} rows={statement.rows as never} forecastFrom={statement.forecastFrom} totalColumn drillable={drillable} onDrill={onDrill} />
      <div className="ll-report-pair">
        <RailBlock title="Operating costs by month">
          <BarChart labels={snapshot.series.labels.slice(-12)} values={snapshot.series.overheads.slice(-12).map((c) => c / 100)} seriesName="Operating costs" height={220} />
        </RailBlock>
        <RailBlock title="Where the year's costs go">{opex.length ? <Treemap items={opex} height={190} /> : <p className="ll-muted">No operating costs yet this year.</p>}</RailBlock>
      </div>
      <RailBlock title="Checked against Xero">{check}</RailBlock>
    </>
  );
}

/** "September revenue was €246k, up 17% on August, and net profit €28k. The biggest change: …" */
function takeaway(snapshot: Snapshot) {
  const m = snapshot.measures;
  const month = monthName(snapshot.asOf);
  const at = snapshot.pnl.columns.findIndex((c) => c.period === snapshot.asOf);
  let top: { label: string; delta: number } | null = null;
  if (at > 0) {
    for (const row of snapshot.pnl.rows) {
      if (row.type !== "line" || !row.values) continue;
      // Costs are held negative; compare sizes so a cost that grew reads as "up".
      const delta = (Math.abs(row.values[at] ?? 0) - Math.abs(row.values[at - 1] ?? 0)) / 100;
      if (!top || Math.abs(delta) > Math.abs(top.delta)) top = { label: row.label ?? "", delta };
    }
  }
  const revenue = `${month} revenue was ${formatMoney(m.revenue / 100, { compact: true })}${m.revenueDelta === null ? "" : `, ${m.revenueDelta >= 0 ? "up" : "down"} ${Math.abs(m.revenueDelta * 100).toFixed(1)}% on the month before`}, ${m.netProfit < 0 ? "with a net loss of" : "and net profit"} ${formatMoney(Math.abs(m.netProfit) / 100, { compact: true })}.`;
  if (!top || Math.abs(top.delta) < 1) return revenue;
  return `${revenue} The biggest single change: ${top.label}, ${top.delta > 0 ? "up" : "down"} ${formatMoney(Math.abs(top.delta), { compact: true })}.`;
}
