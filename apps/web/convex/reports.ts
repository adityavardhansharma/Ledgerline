import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentOrg } from "./lib/auth";
import { ageItems, importedOpenItems, monthEnd } from "./lib/openItems";
import { engine } from "./lib/engine";
import { lastCompleteMonth, toNumber } from "./lib/money";

/** Accounts and monthly movements in the shape the engine expects. */
export const engineInput = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: (ctx, { orgId }) => ledgerInput(ctx, orgId),
});

export async function ledgerInput(ctx: QueryCtx, orgId: Id<"organizations">) {
  const org = await ctx.db.get(orgId);
  if (!org) throw new Error("organisation not found");
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const balances = await ctx.db
    .query("accountBalances")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const latest = balances.reduce((max, b) => (b.period > max ? b.period : max), "");
  const complete = lastCompleteMonth();
  return {
    fyStartMonth: org.fyStartMonth,
    asOf: latest && latest < complete ? latest : complete,
    accounts: accounts.map((a) => ({
      xero_account_id: a.xeroAccountId,
      code: a.code,
      name: a.name,
      type: a.type,
      account_class: a.accountClass,
      system_account: a.systemAccount,
    })),
    balances: balances.map((b) => ({ xero_account_id: b.xeroAccountId, period: b.period, net_cents: toNumber(b.netCents) })),
  };
}

export const rebuild = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const input = await ctx.runQuery(internal.reports.engineInput, { orgId });
    if (!input.balances.length) return;
    const data = await engine("/reports/build", {
      accounts: input.accounts,
      balances: input.balances,
      fy_start_month: input.fyStartMonth,
      as_of: input.asOf,
    });
    await ctx.runMutation(internal.reports.storeSnapshot, { orgId, kind: "statements", data, bumpVersion: true, asOf: input.asOf });
    await ctx.runMutation(internal.scenarios.ensureBase, { orgId });
  },
});

export const storeSnapshot = internalMutation({
  args: {
    orgId: v.id("organizations"),
    kind: v.union(v.literal("statements"), v.literal("ageing"), v.literal("reconciliation")),
    data: v.any(),
    bumpVersion: v.optional(v.boolean()),
    asOf: v.optional(v.string()),
  },
  handler: async (ctx, { orgId, kind, data, bumpVersion, asOf }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return;
    const version = bumpVersion ? org.actualsVersion + 1 : org.actualsVersion;
    if (bumpVersion) await ctx.db.patch(orgId, { actualsVersion: version, asOf });
    await ctx.db.insert("reportSnapshots", { orgId, kind, version, data, createdAt: Date.now() });
    // Keep the three most recent snapshots of each kind.
    const old = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_org_kind", (q) => q.eq("orgId", orgId).eq("kind", kind))
      .order("desc")
      .collect();
    for (const row of old.slice(3)) await ctx.db.delete(row._id);
  },
});

async function latest(ctx: QueryCtx, kind: "statements" | "ageing" | "reconciliation") {
  const found = await currentOrg(ctx);
  if (!found) return null;
  const row = await ctx.db
    .query("reportSnapshots")
    .withIndex("by_org_kind", (q) => q.eq("orgId", found.org._id).eq("kind", kind))
    .order("desc")
    .first();
  return row ? { ...row.data, version: row.version, createdAt: row.createdAt } : null;
}

export const statements = query({ args: {}, handler: (ctx) => latest(ctx, "statements") });
/** Unpaid invoices by age: Xero's own when connected, otherwise worked out from imported journals. */
export const ageing = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    if (found.org.source === "csv" || found.org.source === "sample") {
      if (!found.org.asOf) return null;
      const items = await importedOpenItems(ctx, found.org._id);
      return items ? ageItems(items, monthEnd(found.org.asOf)) : null;
    }
    return latest(ctx, "ageing");
  },
});
export const reconciliation = query({ args: {}, handler: (ctx) => latest(ctx, "reconciliation") });

/** Daily net bank movement for the cash calendar. */
export const dailyCash = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const found = await currentOrg(ctx);
    if (!found) return [];
    const rows = await ctx.db
      .query("dailyCash")
      .withIndex("by_org_date", (q) => q.eq("orgId", found.org._id).gte("date", from).lte("date", to))
      .collect();
    return rows.map((r) => ({ date: r.date, valueCents: toNumber(r.netCents) }));
  },
});
