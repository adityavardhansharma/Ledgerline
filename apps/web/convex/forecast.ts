import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { currentOrg } from "./lib/auth";
import { sha256 } from "./lib/crypto";
import { engine } from "./lib/engine";

export const context = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }) => {
    const found = await currentOrg(ctx);
    const scenario = await ctx.db.get(scenarioId);
    if (!found || !scenario || scenario.orgId !== found.org._id) return null;
    const snapshot = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_org_kind", (q) => q.eq("orgId", found.org._id).eq("kind", "statements"))
      .order("desc")
      .first();
    return { orgId: found.org._id, actualsVersion: found.org.actualsVersion, drivers: snapshot?.data?.drivers ?? null };
  },
});

export const cached = internalQuery({
  args: { scenarioId: v.id("scenarios"), inputsHash: v.string() },
  handler: (ctx, args) =>
    ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario_hash", (q) => q.eq("scenarioId", args.scenarioId).eq("inputsHash", args.inputsHash))
      .first(),
});

export const store = internalMutation({
  args: { orgId: v.id("organizations"), scenarioId: v.id("scenarios"), inputsHash: v.string(), actualsVersion: v.number(), data: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("forecastRuns", { ...args, createdAt: Date.now() });
    await recordPlan(ctx, args.orgId, args.scenarioId, args.data);
    const runs = await ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", args.scenarioId))
      .order("desc")
      .collect();
    for (const old of runs.slice(10)) await ctx.db.delete(old._id);
  },
});

/**
 * The first base-case forecast after a month closes becomes that month's plan: next month's board pack
 * compares what happened with what it expected.
 */
async function recordPlan(ctx: MutationCtx, orgId: Id<"organizations">, scenarioId: Id<"scenarios">, data: unknown) {
  const [org, scenario] = await Promise.all([ctx.db.get(orgId), ctx.db.get(scenarioId)]);
  if (!org?.asOf || !scenario?.isBase) return;
  const months = (data as { months?: { period: string; revenue: number; ebitda: number; netProfit: number; cash: number }[] }).months;
  if (!months?.length || months[0].period <= org.asOf) return;
  const asOf = org.asOf;
  const existing = await ctx.db
    .query("plans")
    .withIndex("by_org_madeAt", (q) => q.eq("orgId", orgId).eq("madeAt", asOf))
    .first();
  if (existing) return;
  await ctx.db.insert("plans", {
    orgId,
    madeAt: asOf,
    months: months.slice(0, 12).map((m) => ({ period: m.period, revenue: m.revenue, ebitda: m.ebitda, netProfit: m.netProfit, cash: m.cash })),
    createdAt: Date.now(),
  });
}

/** Run (or fetch from cache) the forecast for a scenario. Keyed by the actuals version and every input. */
export const run = action({
  args: { scenarioId: v.id("scenarios"), horizon: v.optional(v.number()) },
  handler: async (ctx, { scenarioId, horizon }): Promise<{ cached: boolean }> => {
    const context = await ctx.runQuery(internal.forecast.context, { scenarioId });
    if (!context) throw new ConvexError("Scenario not found.");
    if (!context.drivers) throw new ConvexError("Sync Xero before forecasting.");
    const plan = await ctx.runQuery(internal.scenarios.forForecast, { id: scenarioId });
    if (!plan) throw new ConvexError("Scenario not found.");
    const payload = {
      drivers: { ...context.drivers, ...plan.overrides },
      hires: plan.hires.map(({ id: _id, ...h }) => h),
      oneOffs: plan.oneOffs.map(({ id: _id, ...o }) => o),
      financing: plan.financing.map(({ id: _id, ...f }) => f),
      horizon: Math.min(Math.max(horizon ?? 24, 6), 36),
      seed: 7,
      bands: true,
      sensitivity: true,
    };
    const digest = await sha256(JSON.stringify([context.actualsVersion, payload]));
    const inputsHash = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
    if (await ctx.runQuery(internal.forecast.cached, { scenarioId, inputsHash })) return { cached: true };
    const data = await engine("/forecast/run", payload);
    await ctx.runMutation(internal.forecast.store, { orgId: context.orgId, scenarioId, inputsHash, actualsVersion: context.actualsVersion, data: { ...(data as object), drivers: payload.drivers } });
    return { cached: false };
  },
});

/** The newest forecast for a scenario built on the current actuals. */
export const latest = query({
  args: { scenarioId: v.optional(v.id("scenarios")) },
  handler: async (ctx, { scenarioId }) => {
    const found = await currentOrg(ctx);
    if (!found || !scenarioId) return null;
    const scenario = await ctx.db.get(scenarioId);
    if (!scenario || scenario.orgId !== found.org._id) return null;
    const run = await ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
      .order("desc")
      .first();
    if (!run) return null;
    return { ...run.data, stale: run.actualsVersion !== found.org.actualsVersion, createdAt: run.createdAt };
  },
});
