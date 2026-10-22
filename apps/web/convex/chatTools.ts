import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { describe } from "./commentary";
import { currentOrg } from "./lib/auth";
import { toNumber } from "./lib/money";
import { ageItems, importedOpenItems, monthEnd } from "./lib/openItems";

/**
 * The chat's tools: small, read-only views of the signed-in organisation's figures, in euros. Each is a public
 * query so the model can call it while it thinks and the browser can run it when an answer binds a chart to it.
 */

type Snapshot = {
  asOf: string;
  fyStart: string;
  measures: Record<string, number | null> & { month: string };
  pnl: { columns: { label: string; period?: string }[]; rows: { type: string; label?: string; values?: (number | null)[] }[] };
  series: { periods: string[]; labels: string[] } & Record<string, number[]>;
  opexYtd: { label: string; value: number }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}`;
const longLabel = (p: string) => `${LONG[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const eur = (cents: number | null | undefined) => (cents == null ? 0 : Math.round(cents) / 100);
const pct = (x: number | null | undefined) => (x == null ? null : Math.round(x * 1000) / 10);

async function snapshotFor(ctx: QueryCtx, orgId: Id<"organizations">) {
  const row = await ctx.db
    .query("reportSnapshots")
    .withIndex("by_org_kind", (q) => q.eq("orgId", orgId).eq("kind", "statements"))
    .order("desc")
    .first();
  return row ? (row.data as Snapshot) : null;
}

async function setup(ctx: QueryCtx) {
  const found = await currentOrg(ctx);
  if (!found) return null;
  const snapshot = await snapshotFor(ctx, found.org._id);
  return snapshot ? { org: found.org, snapshot } : null;
}

export const company_overview = query({
  args: {},
  handler: async (ctx) => {
    const s = await setup(ctx);
    if (!s) return { error: "No figures yet. Sync Xero, import a CSV or load the sample company." };
    const m = s.snapshot.measures;
    return {
      company: s.org.name,
      month: m.month,
      monthLabel: longLabel(m.month),
      revenue: eur(m.revenue),
      revenueChangePct: pct(m.revenueDelta),
      grossMarginPct: pct(m.grossMargin),
      ebitda: eur(m.ebitda),
      netProfit: eur(m.netProfit),
      cash: eur(m.cash),
      cashChangePct: pct(m.cashDelta),
      owedByCustomers: eur(m.debtors),
      owedToSuppliers: eur(m.creditors),
      debtorDays: m.debtorDays,
      creditorDays: m.creditorDays,
      currentRatio: m.currentRatio == null ? null : Math.round(m.currentRatio * 100) / 100,
      runwayMonths: m.runwayMonths,
    };
  },
});

const metric = v.union(v.literal("revenue"), v.literal("grossProfit"), v.literal("ebitda"), v.literal("netProfit"), v.literal("cash"), v.literal("overheads"));

export const monthly_trend = query({
  args: { metric, months: v.optional(v.number()) },
  handler: async (ctx, { metric: name, months }) => {
    const s = await setup(ctx);
    if (!s) return { metric: name, rows: [] };
    const n = Math.min(24, Math.max(3, Math.round(months ?? 12)));
    const periods = s.snapshot.series.periods.slice(-n);
    const values = (s.snapshot.series[name] ?? []).slice(-n);
    return { metric: name, rows: periods.map((p, i) => ({ month: p, label: label(p), value: eur(values[i]) })) };
  },
});

export const profit_and_loss = query({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, { month }) => {
    const s = await setup(ctx);
    if (!s) return { month: null, rows: [] };
    const cols = s.snapshot.pnl.columns;
    const target = month && cols.some((c) => c.period === month) ? month : s.snapshot.asOf;
    const index = cols.findIndex((c) => c.period === target);
    let section = "";
    const rows = [];
    for (const r of s.snapshot.pnl.rows) {
      if (r.type === "section") section = r.label ?? "";
      if (!r.values || !r.label) continue;
      rows.push({ account: r.label, kind: r.type === "line" ? section : r.type, month: eur(index >= 0 ? r.values[index] : null), yearToDate: eur(r.values.at(-1)) });
    }
    return { month: target, monthLabel: longLabel(target), rows };
  },
});

export const account_detail = query({
  args: { account: v.string(), months: v.optional(v.number()) },
  handler: async (ctx, { account, months }) => {
    const found = await currentOrg(ctx);
    if (!found?.org.asOf) return { account, rows: [], largest: [] };
    const asOf = found.org.asOf;
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .collect();
    const want = account.trim().toLowerCase();
    const match =
      accounts.find((a) => a.code.toLowerCase() === want || a.name.toLowerCase() === want) ??
      accounts.find((a) => a.name.toLowerCase().includes(want)) ??
      accounts.find((a) => want.split(/\s+/).every((w) => a.name.toLowerCase().includes(w)));
    if (!match) return { account, error: `No account matches "${account}".`, accounts: accounts.slice(0, 60).map((a) => `${a.code} ${a.name}`), rows: [], largest: [] };
    const credit = ["REVENUE", "LIABILITY", "EQUITY"].includes(match.accountClass.toUpperCase()) || ["REVENUE", "SALES", "OTHERINCOME"].includes(match.type.toUpperCase());
    const sign = credit ? -1 : 1;
    const n = Math.min(24, Math.max(3, Math.round(months ?? 12)));
    const periods: string[] = [];
    for (let k = n - 1; k >= 0; k--) {
      const index = Number(asOf.slice(0, 4)) * 12 + Number(asOf.slice(5, 7)) - 1 - k;
      periods.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
    }
    const rows = [];
    for (const p of periods) {
      const row = await ctx.db
        .query("accountBalances")
        .withIndex("by_org_account_period", (q) => q.eq("orgId", found.org._id).eq("xeroAccountId", match.xeroAccountId).eq("period", p))
        .unique();
      rows.push({ month: p, label: label(p), value: eur(row ? sign * toNumber(row.netCents) : 0) });
    }
    const lines = await ctx.db
      .query("ledgerLines")
      .withIndex("by_org_account_period", (q) => q.eq("orgId", found.org._id).eq("xeroAccountId", match.xeroAccountId).eq("period", asOf))
      .take(500);
    const largest = lines
      .map((l) => ({ date: l.date, description: l.description || l.reference, contact: l.contact ?? "", amount: eur(sign * toNumber(l.netCents)) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 6);
    return { account: `${match.code} ${match.name}`.trim(), rows, largest };
  },
});

export const cost_breakdown = query({
  args: {},
  handler: async (ctx) => {
    const s = await setup(ctx);
    if (!s) return { total: 0, rows: [] };
    const items = s.snapshot.opexYtd;
    const total = items.reduce((t, i) => t + i.value, 0);
    return { total: eur(total), rows: items.map((i) => ({ account: i.label, value: eur(i.value), sharePct: total ? Math.round((i.value / total) * 1000) / 10 : 0 })) };
  },
});

async function latestRun(ctx: QueryCtx, scenario: Doc<"scenarios">) {
  const run = await ctx.db
    .query("forecastRuns")
    .withIndex("by_scenario", (q) => q.eq("scenarioId", scenario._id))
    .order("desc")
    .first();
  return run ? (run.data as { runwayMonths: number | null; cashOutPeriod: string | null; lowestCash: number | null; lowestCashPeriod: string | null; months: { period: string; cash: number; revenue: number; ebitda: number }[] }) : null;
}

export const forecast = query({
  args: { scenario: v.optional(v.string()) },
  handler: async (ctx, { scenario }) => {
    const found = await currentOrg(ctx);
    if (!found) return { rows: [] };
    const all = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .collect();
    const want = scenario?.trim().toLowerCase();
    const chosen = (want ? all.find((s) => s.name.toLowerCase() === want) ?? all.find((s) => s.name.toLowerCase().includes(want)) : null) ?? all.find((s) => s.isBase);
    if (!chosen) return { error: "No forecast yet.", rows: [] };
    const run = await latestRun(ctx, chosen);
    if (!run) return { scenario: chosen.name, scenarioId: chosen._id, needsRun: true, error: "This scenario's forecast hasn't run yet.", rows: [] };
    return {
      scenario: chosen.name,
      runwayMonths: run.runwayMonths ?? (run.months.length || 24),
      cashRunsOut: Boolean(run.cashOutPeriod),
      cashOutMonth: run.cashOutPeriod ? longLabel(run.cashOutPeriod) : null,
      lowestCash: eur(run.lowestCash),
      lowestMonth: run.lowestCashPeriod ? longLabel(run.lowestCashPeriod) : null,
      rows: run.months.map((m) => ({ month: m.period, label: label(m.period), cash: eur(m.cash), revenue: eur(m.revenue), ebitda: eur(m.ebitda) })),
    };
  },
});

export const scenarios = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return { rows: [] };
    const all = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .collect();
    const rows = [];
    for (const s of all) {
      const run = await latestRun(ctx, s);
      rows.push({
        name: s.name,
        isBase: s.isBase,
        changes: s.isBase ? "Your actuals carried forward" : describe(s),
        runwayMonths: run ? (run.runwayMonths ?? (run.months.length || 24)) : null,
        cashRunsOut: run ? Boolean(run.cashOutPeriod) : null,
        cashIn12Months: run?.months[11] ? eur(run.months[11].cash) : null,
      });
    }
    return { rows };
  },
});

export const owed_to_you = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found?.org.asOf) return { total: 0, overdue: 0, buckets: [], customers: [] };
    type Ageing = { receivable?: { label: string; value: number }[]; receivableTop?: { contact: string; value: number }[] };
    let ageing: Ageing | null = null;
    if (found.org.source === "csv" || found.org.source === "sample") {
      const items = await importedOpenItems(ctx, found.org._id);
      ageing = items ? (ageItems(items, monthEnd(found.org.asOf)) as Ageing) : null;
    } else {
      const row = await ctx.db
        .query("reportSnapshots")
        .withIndex("by_org_kind", (q) => q.eq("orgId", found.org._id).eq("kind", "ageing"))
        .order("desc")
        .first();
      ageing = (row?.data as Ageing | undefined) ?? null;
    }
    const buckets = (ageing?.receivable ?? []).map((b) => ({ label: b.label, value: eur(b.value) }));
    return {
      total: buckets.reduce((t, b) => t + b.value, 0),
      overdue: buckets.slice(1).reduce((t, b) => t + b.value, 0),
      buckets,
      customers: (ageing?.receivableTop ?? []).map((c) => ({ name: c.contact, value: eur(c.value) })),
    };
  },
});

export const top_customers = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, { months }) => {
    const found = await currentOrg(ctx);
    if (!found?.org.asOf) return { total: 0, rows: [] };
    const asOf = found.org.asOf;
    const n = Math.min(12, Math.max(1, Math.round(months ?? 3)));
    const index = Number(asOf.slice(0, 4)) * 12 + Number(asOf.slice(5, 7)) - n;
    const from = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .collect();
    const sales = new Map<string, number>();
    for (const a of accounts.filter((x) => ["REVENUE", "SALES"].includes(x.type.toUpperCase()))) {
      const lines = await ctx.db
        .query("ledgerLines")
        .withIndex("by_org_account_period", (q) => q.eq("orgId", found.org._id).eq("xeroAccountId", a.xeroAccountId).gt("period", from).lte("period", asOf))
        .take(4000);
      for (const l of lines) if (l.contact) sales.set(l.contact, (sales.get(l.contact) ?? 0) - toNumber(l.netCents));
    }
    const total = [...sales.values()].reduce((t, x) => t + x, 0);
    const rows = [...sales]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: eur(value), sharePct: total ? Math.round((value / total) * 1000) / 10 : 0 }));
    return rows.length ? { total: eur(total), rows } : { total: 0, rows: [], note: "These books don't name customers on sales lines." };
  },
});
