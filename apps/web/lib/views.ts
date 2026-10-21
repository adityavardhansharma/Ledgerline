import type { ForecastRun, Snapshot, Statement } from "./types";
import { periodLabel } from "./format";

const toEuros = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

/** Statement rows for <FinancialStatement>, in euros. */
export function statementRows(statement: Statement) {
  return statement.rows.map((row) => ({ ...row, values: row.values?.map(toEuros) }));
}

/** Overlay a forecast on the empty future months of the P&L: subtotals and totals only, in forecast blue. */
export function pnlWithForecast(statement: Statement, forecast: ForecastRun | null | undefined) {
  const rows = statementRows(statement);
  const columns = statement.columns;
  const firstForecast = columns.findIndex((c) => c.kind === "F");
  if (!forecast || firstForecast < 0) return { columns, rows, forecastFrom: firstForecast < 0 ? undefined : firstForecast };
  const byPeriod = new Map(forecast.months.map((m) => [m.period, m]));
  const pick: Record<string, (m: ForecastRun["months"][number]) => number> = {
    "Gross profit": (m) => m.grossProfit,
    "Total operating expenses": (m) => m.overheads + m.hires,
    EBITDA: (m) => m.ebitda,
    "Net profit": (m) => m.netProfit,
  };
  for (const row of rows) {
    const fn = row.label ? pick[row.label] : undefined;
    if (!fn || !row.values) continue;
    columns.forEach((col, i) => {
      if (col.kind !== "F" || !col.period) return;
      const month = byPeriod.get(col.period);
      if (month && row.values) row.values[i] = fn(month) / 100;
    });
  }
  return { columns, rows, forecastFrom: firstForecast };
}

/** Actual month-end cash for the last year, then the forecast with its bands and an optional scenario. */
export function cashChart(snapshot: Snapshot, base?: ForecastRun | null, scenario?: ForecastRun | null, history = 12) {
  const actualLabels = snapshot.series.labels.slice(-history);
  const actual = snapshot.series.cash.slice(-history).map((c) => c / 100);
  const horizon = base ? base.months.slice(0, 12) : [];
  const labels = [...actualLabels, ...horizon.map((m) => m.label)];
  const pad = (values: (number | null)[]) => [...actual.map((_, i) => (i === actual.length - 1 ? actual[i] : null)), ...values];
  const series: { name: string; kind: string; values?: (number | null)[]; lower?: (number | null)[]; upper?: (number | null)[]; opacity?: number }[] = [];
  if (base?.bands) {
    const band = (lo: number[], hi: number[], name: string, opacity?: number) => ({
      name,
      kind: "band",
      lower: pad(lo.slice(0, horizon.length).map((c) => c / 100)),
      upper: pad(hi.slice(0, horizon.length).map((c) => c / 100)),
      opacity,
    });
    series.push(band(base.bands.p10, base.bands.p90, "Likely range (P10–P90)", 0.6));
    series.push(band(base.bands.p25, base.bands.p75, "Probable range (P25–P75)"));
  }
  series.push({ name: "Cash at bank", kind: "actual", values: [...actual, ...horizon.map(() => null)] });
  if (base) series.push({ name: "Base case", kind: "forecast", values: pad(horizon.map((m) => m.cash / 100)) });
  if (scenario) series.push({ name: "This scenario", kind: "scenario", values: pad(scenario.months.slice(0, 12).map((m) => m.cash / 100)) });
  return { labels, series, forecastFrom: base ? actualLabels.length : undefined };
}

export const bridgeSteps = (snapshot: Snapshot) => snapshot.bridge.map((s) => ({ ...s, value: s.value / 100 }));

export const sankeyData = (snapshot: Snapshot) => ({
  nodes: snapshot.sankey.nodes,
  links: snapshot.sankey.links.map((l) => ({ ...l, value: l.value / 100 })),
});

export const opexItems = (snapshot: Snapshot) => snapshot.opexYtd.map((i) => ({ ...i, value: i.value / 100 }));

export function monthName(period: string) {
  return periodLabel(period);
}

export const cents = toEuros;
