import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, query, type ActionCtx, type MutationCtx, type QueryCtx } from "./_generated/server";
import { currentOrg } from "./lib/auth";
import { sha256 } from "./lib/crypto";
import { engine } from "./lib/engine";
import { resolve } from "./scenarios";

/** Everything a scenario's forecast is built from: its organisation's actuals and drivers, and its resolved plan. */
async function inputsFor(ctx: QueryCtx, scenarioId: Id<"scenarios">) {
  const scenario = await ctx.db.get(scenarioId);
  if (!scenario) return null;
  const org = await ctx.db.get(scenario.orgId);
  if (!org) return null;
  const snapshot = await ctx.db
    .query("reportSnapshots")
    .withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", "statements"))
    .order("desc")
    .first();
  const plan = await resolve(ctx, scenario);
  return {
    orgId: org._id,
    actualsVersion: org.actualsVersion,
    drivers: (snapshot?.data?.drivers ?? null) as Record<string, unknown> | null,
    plan: { overrides: plan.overrides, hires: plan.hires, oneOffs: plan.oneOffs, financing: plan.financing },
  };
}
type Inputs = NonNullable<Awaited<ReturnType<typeof inputsFor>>>;

/** The inputs for the signed-in person's own scenario, or null. */
export const context = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }) => {
    const found = await currentOrg(ctx);
    const scenario = await ctx.db.get(scenarioId);
    if (!found || !scenario || scenario.orgId !== found.org._id) return null;
    return inputsFor(ctx, scenarioId);
  },
});

/** The inputs for any scenario, for forecasts the backend schedules itself. */
export const inputs = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: (ctx, { scenarioId }) => inputsFor(ctx, scenarioId),
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

function payloadFor(input: Inputs, horizon?: number, full = true) {
  return {
    drivers: { ...input.drivers, ...input.plan.overrides },
    hires: input.plan.hires.map(({ id: _id, ...h }) => h),
    oneOffs: input.plan.oneOffs.map(({ id: _id, ...o }) => o),
    financing: input.plan.financing.map(({ id: _id, ...f }) => f),
    horizon: Math.min(Math.max(horizon ?? 24, 6), 36),
    seed: 7,
    // The bands (200 perturbed runs) and the sensitivity (a rerun per driver) are most of the engine's work.
    bands: full,
    sensitivity: full,
  };
}

async function hashOf(actualsVersion: number, payload: unknown) {
  const digest = await sha256(JSON.stringify([actualsVersion, payload]));
  return Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Run the forecast for these inputs unless a run for exactly them is stored, in which case that run becomes the
 * newest again (going back to earlier values shows their forecast). A newer edit can land while the engine works;
 * the result is then dropped rather than stored over the newer run, which its own refresh writes.
 */
async function compute(ctx: ActionCtx, scenarioId: Id<"scenarios">, input: Inputs, opts: { horizon?: number; full?: boolean } = {}): Promise<{ cached: boolean }> {
  if (!input.drivers) throw new ConvexError("Sync Xero before forecasting.");
  const full = opts.full ?? true;
  const payload = payloadFor(input, opts.horizon, full);
  const inputsHash = await hashOf(input.actualsVersion, payload);
  if (await ctx.runMutation(internal.forecast.promote, { scenarioId, inputsHash })) return { cached: true };
  const data = await engine("/forecast/run", payload);
  const now = await ctx.runQuery(internal.forecast.inputs, { scenarioId });
  if (!now || (await hashOf(now.actualsVersion, payloadFor(now, opts.horizon, full))) !== inputsHash) return { cached: false };
  await ctx.runMutation(internal.forecast.store, { orgId: input.orgId, scenarioId, inputsHash, actualsVersion: input.actualsVersion, data: { ...(data as object), drivers: payload.drivers } });
  return { cached: false };
}

/** Make the stored run for these inputs the scenario's newest. False when there is none. */
export const promote = internalMutation({
  args: { scenarioId: v.id("scenarios"), inputsHash: v.string() },
  handler: async (ctx, { scenarioId, inputsHash }) => {
    const hit = await ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario_hash", (q) => q.eq("scenarioId", scenarioId).eq("inputsHash", inputsHash))
      .first();
    if (!hit) return false;
    const newest = await ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
      .order("desc")
      .first();
    if (newest && newest._id !== hit._id) await ctx.db.patch(hit._id, { createdAt: Math.max(Date.now(), newest.createdAt + 1) });
    return true;
  },
});

/** Run (or fetch from cache) the forecast for a scenario. Keyed by the actuals version and every input. */
export const run = action({
  args: { scenarioId: v.id("scenarios"), horizon: v.optional(v.number()) },
  handler: async (ctx, { scenarioId, horizon }): Promise<{ cached: boolean }> => {
    const input = await ctx.runQuery(internal.forecast.context, { scenarioId });
    if (!input) throw new ConvexError("Scenario not found.");
    return compute(ctx, scenarioId, input, { horizon });
  },
});

/**
 * Bring a scenario's forecast up to date after its inputs changed, without anyone waiting on it: pages only read
 * the newest run. Scheduled by the mutations that change a scenario and by every rebuild of the figures.
 */
export const refresh = internalAction({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }) => {
    const input = await ctx.runQuery(internal.forecast.inputs, { scenarioId });
    if (!input?.drivers) return;
    // A quick pass without bands or sensitivity puts the new cash line on screen first; the full run replaces it.
    const full = payloadFor(input);
    if (await ctx.runMutation(internal.forecast.promote, { scenarioId, inputsHash: await hashOf(input.actualsVersion, full) })) return;
    await compute(ctx, scenarioId, input, { full: false });
    await compute(ctx, scenarioId, input, { full: true });
  },
});

/** Schedule a refresh for a scenario and every scenario branched from it, whose inputs it also changes. */
export async function scheduleRefresh(ctx: MutationCtx, orgId: Id<"organizations">, scenarioId?: Id<"scenarios">) {
  const all = await ctx.db
    .query("scenarios")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const affected = new Set<Id<"scenarios">>(scenarioId ? [scenarioId] : all.map((s) => s._id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of all) {
      if (s.parentId && affected.has(s.parentId) && !affected.has(s._id)) {
        affected.add(s._id);
        grew = true;
      }
    }
  }
  // A short wait lets a burst of edits (a slider being dragged) settle; each refresh drops results its inputs outgrew.
  for (const id of affected) await ctx.scheduler.runAfter(250, internal.forecast.refresh, { scenarioId: id });
}

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
