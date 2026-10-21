import { download } from "./exportHtml";
import type { ForecastRun, Snapshot, Statement } from "./types";

type Cell = string | number | null | undefined;

/**
 * Rows to CSV for spreadsheets. Amounts are plain numbers in euro with two decimals and a minus sign.
 * Text that a spreadsheet would run as a formula (=, +, @, or - not followed by a digit) is prefixed
 * with an apostrophe, so an exported description can't execute anything.
 */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    const s = /^[=+@\t\r]|^-(?![\d.])/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

export const euro = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : (cents / 100).toFixed(2));

/** Download CSV with a byte-order mark, so Excel reads € and accented names correctly. */
export function downloadCsvText(filename: string, csv: string) {
  download(filename.endsWith(".csv") ? filename : `${filename}.csv`, `﻿${csv}`, "text/csv;charset=utf-8");
}

/** A statement as laid out on screen: code, account, then one column per period. */
export function statementCsv(statement: Statement): string {
  const rows: Cell[][] = [["Code", "Account", ...statement.columns.map((c) => (c.kind === "F" ? `${c.label} (forecast)` : c.label))]];
  for (const row of statement.rows) {
    if (row.type === "spacer") continue;
    rows.push([row.code ?? "", row.type === "section" ? (row.label ?? "").toUpperCase() : (row.label ?? ""), ...(row.values ?? []).map(euro)]);
  }
  return toCsv(rows);
}

export function downloadCsv(filename: string, statement: Statement) {
  downloadCsvText(filename, statementCsv(statement));
}

/** Month by month: the headline figures behind the overview's charts and KPI tiles. */
export function monthlySummaryCsv(snapshot: Snapshot): string {
  const s = snapshot.series;
  const rows: Cell[][] = [["Month", "Revenue", "Gross profit", "Operating costs", "EBITDA", "Net profit", "Cash at bank"]];
  s.periods.forEach((period, i) => rows.push([period, euro(s.revenue[i]), euro(s.grossProfit[i]), euro(s.overheads[i]), euro(s.ebitda[i]), euro(s.netProfit[i]), euro(s.cash[i])]));
  const m = snapshot.measures;
  rows.push([]);
  rows.push(["Measure", `As of ${m.month}`]);
  for (const [label, value] of [
    ["Debtor days", m.debtorDays],
    ["Creditor days", m.creditorDays],
    ["Stock days", m.stockDays],
    ["Current ratio", m.currentRatio],
    ["Gross margin", m.grossMargin],
    ["Monthly burn", euro(m.burn)],
    ["Runway (months)", m.runwayMonths],
  ] as const) {
    rows.push([label, value === null ? "" : typeof value === "number" ? Number(value.toFixed(4)) : value]);
  }
  return toCsv(rows);
}

/** The forecast's three statements, one row per month. */
export function forecastCsv(run: ForecastRun, scenario: string): string {
  const header = ["Scenario", "Month", "Revenue", "Cost of sales", "Gross profit", "Overheads", "New hires", "EBITDA", "Depreciation", "Interest", "Tax", "Net profit", "Cash", "Debtors", "Creditors", "Loan", "Equity"];
  const rows: Cell[][] = [header];
  run.months.forEach((m, i) => {
    rows.push([
      scenario,
      m.period,
      ...[m.revenue, m.costOfSales, m.grossProfit, m.overheads, m.hires, m.ebitda, m.depreciation, m.interest, m.tax, m.netProfit, m.cash, m.debtors, m.creditors, m.loan, m.equity].map(euro),
    ]);
    if (run.bands) {
      const b = run.bands;
      rows[rows.length - 1].push(euro(b.p10[i]), euro(b.p25[i]), euro(b.p75[i]), euro(b.p90[i]));
    }
  });
  if (run.bands) header.push("Cash P10", "Cash P25", "Cash P75", "Cash P90");
  return toCsv(rows);
}
