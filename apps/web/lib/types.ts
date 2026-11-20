// Shapes of the snapshots the finance engine returns. Money is integer cents.

export interface StatementRow {
  type: "section" | "line" | "subtotal" | "total" | "spacer";
  label?: string;
  code?: string;
  accountId?: string;
  values?: (number | null)[];
}

export interface Statement {
  columns: { label: string; kind?: string; period?: string }[];
  rows: StatementRow[];
}

export interface Measures {
  month: string;
  revenue: number;
  revenueDelta: number | null;
  grossProfit: number;
  grossMargin: number | null;
  ebitda: number;
  netProfit: number;
  netProfitDelta: number | null;
  cash: number;
  cashDelta: number | null;
  debtors: number;
  creditors: number;
  debtorDays: number | null;
  creditorDays: number | null;
  stockDays: number | null;
  currentRatio: number | null;
  burn: number;
  runwayMonths: number | null;
}

export interface Snapshot {
  asOf: string;
  fyStart: string;
  pnl: Statement;
  balance: Statement & { netAssets: number[]; totalAssets: number[] };
  cashflow: Statement;
  bridge: { label: string; value: number; kind?: "start" | "end" }[];
  sankey: { nodes: { id: string; label: string; col: number; tone?: string; emphasis?: boolean }[]; links: { source: string; target: string; value: number }[] };
  measures: Measures;
  series: { periods: string[]; labels: string[]; revenue: number[]; grossProfit: number[]; ebitda: number[]; netProfit: number[]; cash: number[]; overheads: number[] };
  opexYtd: { label: string; value: number; swatch: number }[];
  drivers: Record<string, unknown> & { startPeriod: string; growth: number; grossMargin: number; debtorDays: number; creditorDays: number; stockDays: number; overheadGrowth: number; overheadsMonthly: number };
  version: number;
  createdAt: number;
}

export interface ForecastMonth {
  period: string;
  label: string;
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  overheads: number;
  hires: number;
  ebitda: number;
  depreciation: number;
  interest: number;
  tax: number;
  netProfit: number;
  cash: number;
  debtors: number;
  creditors: number;
  loan: number;
  equity: number;
}

export interface ForecastRun {
  months: ForecastMonth[];
  runwayMonths: number | null;
  cashOutPeriod: string | null;
  lowestCash: number | null;
  lowestCashPeriod: string | null;
  endCash: number | null;
  revenueFirst12: number;
  ebitdaFirst12: number;
  bands?: { p10: number[]; p25: number[]; p75: number[]; p90: number[] };
  sensitivity?: { base: number; capped: boolean; rows: { label: string; range: string; low: number; high: number }[] };
  stale?: boolean;
  /** When the run was stored, in milliseconds. */
  createdAt?: number;
}
