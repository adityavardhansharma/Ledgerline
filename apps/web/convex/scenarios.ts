import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { financing, hire, oneOff } from "./schema";
import { audit } from "./lib/audit";
import { currentOrg, requireOrg } from "./lib/auth";
import { scheduleRefresh } from "./forecast";

/** Drivers a scenario may override, with the range a person can set. */
export const DRIVER_LIMITS: Record<string, [number, number, string]> = {
  growth: [-0.2, 0.5, "revenue growth a month"],
  grossMargin: [0, 1, "gross margin"],
  debtorDays: [0, 365, "debtor days"],
  creditorDays: [0, 365, "creditor days"],
  stockDays: [0, 365, "stock days"],
  overheadGrowth: [-0.5, 1, "overheads growth a year"],
  overheadsMonthly: [0, 1e12, "monthly overheads"],
  interestRate: [0, 1, "interest rate"],
  taxRate: [0, 1, "corporation tax rate"],
};

export interface Resolved {
  chain: Doc<"scenarios">[];
  overrides: Record<string, number>;
  inherited: Record<string, number>;
  hires: Doc<"scenarios">["hires"];
  oneOffs: Doc<"scenarios">["oneOffs"];
  financing: Doc<"scenarios">["financing"];
}

/** Walk from the base to a scenario, applying each branch's changes in order, like commits on a branch. */
export async function resolve(ctx: QueryCtx, scenario: Doc<"scenarios">): Promise<Resolved> {
  const chain: Doc<"scenarios">[] = [];
  let current: Doc<"scenarios"> | null = scenario;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? await ctx.db.get(current.parentId) : null;
    if (chain.length > 20) throw new Error("scenario chain too deep");
  }
  const overrides: Record<string, number> = {};
  const inherited: Record<string, number> = {};
  for (const step of chain) {
    for (const [k, value] of Object.entries(step.overrides)) {
      if (step._id !== scenario._id) inherited[k] = value;
      overrides[k] = value;
    }
  }
  return {
    chain,
    overrides,
    inherited,
    hires: chain.flatMap((s) => s.hires),
    oneOffs: chain.flatMap((s) => s.oneOffs),
    financing: chain.flatMap((s) => s.financing),
  };
}

export const ensureBase = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const base = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .filter((q) => q.eq(q.field("isBase"), true))
      .first();
    if (base) return base._id;
    const now = Date.now();
    const id = await ctx.db.insert("scenarios", {
      orgId,
      name: "Base case",
      isBase: true,
      overrides: {},
      hires: [],
      oneOffs: [],
      financing: [],
      createdBy: "Ledgerline",
      createdAt: now,
      updatedAt: now,
    });
    await scheduleRefresh(ctx, orgId, id);
    return id;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return [];
    const rows = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .collect();
    const byId = new Map(rows.map((r) => [r._id, r]));
    const out = [];
    for (const s of rows) {
      const run = await ctx.db
        .query("forecastRuns")
        .withIndex("by_scenario", (q) => q.eq("scenarioId", s._id))
        .order("desc")
        .first();
      const fresh = run && run.actualsVersion === found.org.actualsVersion ? run.data : null;
      out.push({
        id: s._id,
        name: s.name,
        isBase: s.isBase,
        parentId: s.parentId ?? null,
        parentName: s.parentId ? (byId.get(s.parentId)?.name ?? null) : null,
        changes: Object.keys(s.overrides).length + s.hires.length + s.oneOffs.length + s.financing.length,
        updatedAt: s.updatedAt,
        summary: fresh
          ? {
              runwayMonths: fresh.runwayMonths,
              cashOutPeriod: fresh.cashOutPeriod,
              endCash: fresh.endCash,
              lowestCash: fresh.lowestCash,
              revenueFirst12: fresh.revenueFirst12,
              ebitdaFirst12: fresh.ebitdaFirst12,
            }
          : null,
      });
    }
    return out.sort((a, b) => Number(b.isBase) - Number(a.isBase) || a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("scenarios") },
  handler: async (ctx, { id }) => {
    const found = await currentOrg(ctx);
    const scenario = await ctx.db.get(id);
    if (!found || !scenario || scenario.orgId !== found.org._id) return null;
    const resolved = await resolve(ctx, scenario);
    return {
      id: scenario._id,
      name: scenario.name,
      isBase: scenario.isBase,
      parentName: resolved.chain.length > 1 ? resolved.chain[resolved.chain.length - 2].name : null,
      own: { overrides: scenario.overrides, hires: scenario.hires, oneOffs: scenario.oneOffs, financing: scenario.financing },
      inherited: resolved.inherited,
      overrides: resolved.overrides,
      hires: resolved.hires,
      oneOffs: resolved.oneOffs,
      financing: resolved.financing,
    };
  },
});

async function editable(ctx: Parameters<typeof requireOrg>[0], id: Id<"scenarios">) {
  const found = await requireOrg(ctx, { write: true });
  const scenario = await ctx.db.get(id);
  if (!scenario || scenario.orgId !== found.org._id) throw new ConvexError("Scenario not found.");
  return { ...found, scenario };
}

export const branch = mutation({
  args: { fromId: v.id("scenarios"), name: v.string() },
  handler: async (ctx, { fromId, name }) => {
    const { org, who, scenario } = await editable(ctx, fromId);
    const trimmed = name.trim();
    if (!trimmed) throw new ConvexError("Give the scenario a name.");
    const now = Date.now();
    const id = await ctx.db.insert("scenarios", {
      orgId: org._id,
      parentId: scenario._id,
      name: trimmed.slice(0, 80),
      isBase: false,
      overrides: {},
      hires: [],
      oneOffs: [],
      financing: [],
      createdBy: who.name,
      createdAt: now,
      updatedAt: now,
    });
    await scheduleRefresh(ctx, org._id, id);
    await audit(ctx, org._id, { actor: who.name, action: "branched", target: trimmed, detail: `From ${scenario.name}`, icon: "branch", tone: "forecast" });
    return id;
  },
});

export const rename = mutation({
  args: { id: v.id("scenarios"), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const { org, who, scenario } = await editable(ctx, id);
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) throw new ConvexError("Give the scenario a name.");
    await ctx.db.patch(id, { name: trimmed, updatedAt: Date.now() });
    await audit(ctx, org._id, { actor: who.name, action: "renamed", target: trimmed, detail: `Was ${scenario.name}`, icon: "edit" });
  },
});

export const remove = mutation({
  args: { id: v.id("scenarios") },
  handler: async (ctx, { id }) => {
    const { org, who, scenario } = await editable(ctx, id);
    if (scenario.isBase) throw new ConvexError("The base case can't be deleted.");
    const children = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .filter((q) => q.eq(q.field("parentId"), id))
      .collect();
    // Children keep their changes and move up to this scenario's parent, with its changes folded in.
    for (const child of children) {
      await ctx.db.patch(child._id, {
        parentId: scenario.parentId,
        overrides: { ...scenario.overrides, ...child.overrides },
        hires: [...scenario.hires, ...child.hires],
        oneOffs: [...scenario.oneOffs, ...child.oneOffs],
        financing: [...scenario.financing, ...child.financing],
      });
    }
    const runs = await ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", id))
      .collect();
    for (const run of runs) await ctx.db.delete(run._id);
    await ctx.db.delete(id);
    await audit(ctx, org._id, { actor: who.name, action: "deleted scenario", target: scenario.name, icon: "trash", tone: "negative" });
  },
});

/** A driver as people read it: days, euros for monthly overheads (held in cents), rates as percentages. */
function shown(key: string, value: number) {
  if (key.endsWith("Days")) return `${Math.round(value)} days`;
  if (key === "overheadsMonthly") return `€${Math.round(value / 100).toLocaleString("en-IE")}`;
  return `${Number((value * 100).toFixed(2))}%`;
}

export const setOverride = mutation({
  args: { id: v.id("scenarios"), key: v.string(), value: v.union(v.number(), v.null()) },
  handler: async (ctx, { id, key, value }) => {
    const { org, who, scenario } = await editable(ctx, id);
    const limits = DRIVER_LIMITS[key];
    if (!limits) throw new ConvexError(`Unknown driver ${key}.`);
    const overrides = { ...scenario.overrides };
    if (value === null) delete overrides[key];
    else {
      if (!Number.isFinite(value) || value < limits[0] || value > limits[1]) throw new ConvexError(`Enter a ${limits[2]} between ${limits[0]} and ${limits[1]}.`);
      overrides[key] = value;
    }
    await ctx.db.patch(id, { overrides, updatedAt: Date.now() });
    await scheduleRefresh(ctx, org._id, id);
    const before = scenario.overrides[key];
    await audit(ctx, org._id, {
      actor: who.name,
      action: value === null ? `reset ${limits[2]} in` : `changed ${limits[2]} in`,
      target: scenario.name,
      detail: value === null ? "Back to the parent's value" : `${before === undefined ? "inherited" : shown(key, before)} → ${shown(key, value)}`,
      icon: "edit",
      tone: "forecast",
    });
  },
});

export const setPlanItems = mutation({
  args: {
    id: v.id("scenarios"),
    hires: v.optional(v.array(hire)),
    oneOffs: v.optional(v.array(oneOff)),
    financing: v.optional(v.array(financing)),
  },
  handler: async (ctx, { id, ...items }) => {
    const { org, who, scenario } = await editable(ctx, id);
    for (const h of items.hires ?? []) {
      if (h.salaryCents < 0 || h.count < 1 || !/^\d{4}-\d{2}$/.test(h.startPeriod)) throw new ConvexError("Check the hire's salary, count and start month.");
    }
    const patch: Partial<Doc<"scenarios">> = { updatedAt: Date.now() };
    if (items.hires) patch.hires = items.hires;
    if (items.oneOffs) patch.oneOffs = items.oneOffs;
    if (items.financing) patch.financing = items.financing;
    await ctx.db.patch(id, patch);
    await scheduleRefresh(ctx, org._id, id);
    const what = items.hires ? "hires" : items.oneOffs ? "one-off items" : "financing";
    await audit(ctx, org._id, { actor: who.name, action: `updated ${what} in`, target: scenario.name, icon: items.hires ? "hire" : "edit", tone: "forecast" });
  },
});

