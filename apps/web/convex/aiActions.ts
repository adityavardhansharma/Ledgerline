import type { FunctionReturnType } from "convex/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, type ActionCtx, type QueryCtx } from "./_generated/server";
import { describe, type Prose } from "./commentary";
import { requireOrg } from "./lib/auth";
import { EngineError, engine } from "./lib/engine";
import { toNumber } from "./lib/money";
import { limitError, remaining } from "./lib/plan";
import { importedOpenItems, monthEnd } from "./lib/openItems";
import { persistRotated } from "./lib/tokens";
import { ledgerInput } from "./reports";
import { resolve } from "./scenarios";
import type { Tokens } from "./xero";

/**
 * AI actions: small, single-purpose AI steps placed where they're needed (explain a figure, read a scenario
 * sentence, map a CSV). Explaining actions cite figures the engine computed, as the board-pack commentary does;
 * parsing actions return fields for the person to confirm. Answers are kept until the figures they explain
 * change, so asking twice costs nothing, and every model call is logged per organisation for metering. When the
 * month's AI actions run out, the last answer kept for the same question comes back with the paused message.
 */

export type Explanation = { paragraphs: Prose[] };

// ---------- shared ----------

export const context = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org, who } = await requireOrg(ctx);
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const imported = org.source === "csv" || org.source === "sample";
    return {
      orgId: org._id,
      orgName: org.name,
      who: who.name,
      version: org.actualsVersion,
      asOf: org.asOf ?? null,
      imported,
      mode: imported ? "journals" : (connection?.mode ?? "journals"),
      connected: !imported && connection?.status === "connected",
      lastSyncAt: connection?.lastSyncAt ?? null,
    };
  },
});
type Context = FunctionReturnType<typeof internal.aiActions.context>;

export const cacheGet = internalQuery({
  args: { orgId: v.id("organizations"), key: v.string(), version: v.number() },
  handler: async (ctx, { orgId, key, version }) => {
    const row = await ctx.db
      .query("aiCache")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", key))
      .first();
    return row && row.version === version ? row.data : null;
  },
});

export const cacheSet = internalMutation({
  args: { orgId: v.id("organizations"), key: v.string(), version: v.number(), data: v.any(), action: v.string(), by: v.string() },
  handler: async (ctx, { orgId, key, version, data, action: name, by }) => {
    const old = await ctx.db
      .query("aiCache")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", key))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);
    if (key) await ctx.db.insert("aiCache", { orgId, key, version, data, createdAt: Date.now() });
    await ctx.db.insert("aiUsage", { orgId, action: name, by, at: Date.now() });
  },
});

/** Null while AI actions are left this month; otherwise when they reset and the last answer kept for this key. */
export const paused = internalQuery({
  args: { orgId: v.id("organizations"), key: v.string() },
  handler: async (ctx, { orgId, key }) => {
    const { left, resetsAt, limit } = await remaining(ctx, orgId, "actions");
    if (left > 0) return null;
    const row = key
      ? await ctx.db
          .query("aiCache")
          .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", key))
          .first()
      : null;
    return { resetsAt, limit, last: row?.data ?? null };
  },
});

/** Run an action once per version of the figures: cached answers come back without a model call. */
async function once<T>(ctx: ActionCtx, c: Context, name: string, key: string | null, version: number, fn: () => Promise<T>, fresh = false): Promise<T> {
  if (key && !fresh) {
    const hit = await ctx.runQuery(internal.aiActions.cacheGet, { orgId: c.orgId, key, version });
    if (hit) return hit as T;
  }
  const stop = await ctx.runQuery(internal.aiActions.paused, { orgId: c.orgId, key: key ?? "" });
  if (stop) throw limitError("actions", stop.resetsAt, stop.last, stop.limit);
  let data: T;
  try {
    data = await fn();
  } catch (err) {
    if (err instanceof ConvexError) throw err;
    if (err instanceof EngineError) {
      console.error(`AI action ${name} failed`, err.status, JSON.stringify(err.body).slice(0, 500));
      throw new ConvexError(err.status === 422 ? "The answer didn't pass its checks. Try again." : err.status === 429 ? "Xero is busy. Try again in a minute." : "The AI service didn't answer. Try again in a moment.");
    }
    throw err;
  }
  await ctx.runMutation(internal.aiActions.cacheSet, { orgId: c.orgId, key: key ?? "", version, data, action: name, by: c.who });
  return data;
}

const sign = (accountClass: string, type: string) => {
  const cls = accountClass.toUpperCase();
  const t = type.toUpperCase();
  return cls === "REVENUE" || cls === "LIABILITY" || cls === "EQUITY" || ["REVENUE", "SALES", "OTHERINCOME", "CURRLIAB", "LIABILITY", "TERMLIAB", "EQUITY"].includes(t) ? -1 : 1;
};
const kindOf = (accountClass: string, type: string) => {
  const cls = (accountClass || "").toUpperCase();
  if (cls === "REVENUE" || ["REVENUE", "SALES", "OTHERINCOME"].includes(type.toUpperCase())) return "income";
  if (cls === "ASSET") return "asset";
  if (cls === "LIABILITY") return "liability";
  if (cls === "EQUITY") return "equity";
  return "cost";
};
const periodAdd = (period: string, months: number) => {
  const index = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

async function lineRows(ctx: QueryCtx, orgId: Id<"organizations">, accountId: string, period: string, s: number, take = 400) {
  const lines = await ctx.db
    .query("ledgerLines")
    .withIndex("by_org_account_period", (q) => q.eq("orgId", orgId).eq("xeroAccountId", accountId).eq("period", period))
    .take(take);
  return lines.map((l) => ({ date: l.date, description: l.description, contact: l.contact ?? "", reference: l.reference, source: l.sourceType, cents: s * toNumber(l.netCents) }));
}

// ---------- why did this figure move ----------

export const figureInput = internalQuery({
  args: { accountId: v.string(), period: v.string() },
  handler: async (ctx, { accountId, period }) => {
    const { org } = await requireOrg(ctx);
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_org_xero", (q) => q.eq("orgId", org._id).eq("xeroAccountId", accountId))
      .unique();
    const s = account ? sign(account.accountClass, account.type) : 1;
    const moved = async (p: string) => {
      const row = await ctx.db
        .query("accountBalances")
        .withIndex("by_org_account_period", (q) => q.eq("orgId", org._id).eq("xeroAccountId", accountId).eq("period", p))
        .unique();
      return row ? s * toNumber(row.netCents) : null;
    };
    return {
      account: account?.name ?? "This account",
      kind: account ? kindOf(account.accountClass, account.type) : "cost",
      sign: s,
      value: (await moved(period)) ?? 0,
      previous: await moved(periodAdd(period, -1)),
      lastYear: await moved(periodAdd(period, -12)),
      lines: await lineRows(ctx, org._id, accountId, period, s),
    };
  },
});

export const explainFigure = action({
  args: { accountId: v.string(), period: v.string() },
  handler: async (ctx, { accountId, period }): Promise<Explanation> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    return once(ctx, c, "explainFigure", `figure:${accountId}:${period}`, c.version, async () => {
      const input = await ctx.runQuery(internal.aiActions.figureInput, { accountId, period });
      let lines = input.lines;
      let other = 0;
      if (c.mode === "reports" && !c.imported) {
        const activity = await ctx.runAction(api.ledger.activity, { xeroAccountId: accountId, period });
        if (activity) {
          lines = activity.lines.map((l) => ({ date: l.date, description: l.description, contact: l.contact, reference: l.reference, source: l.source, cents: input.sign * l.net_cents }));
          other = input.sign * activity.unexplained_cents;
        }
      }
      return engine<Explanation>("/actions/explain-figure", {
        account: input.account,
        kind: input.kind,
        period,
        value_cents: input.value,
        previous_cents: input.previous,
        last_year_cents: input.lastYear,
        lines,
        other_cents: other,
      });
    });
  },
});

// ---------- why does cash dip ----------

export const cashDipInput = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }) => {
    const { org } = await requireOrg(ctx);
    const scenario = await ctx.db.get(scenarioId);
    if (!scenario || scenario.orgId !== org._id) return null;
    const run = await ctx.db
      .query("forecastRuns")
      .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
      .order("desc")
      .first();
    if (!run || run.actualsVersion !== org.actualsVersion) return null;
    const plan = await resolve(ctx, scenario);
    const data = run.data as Record<string, unknown> & { months: Record<string, number | string>[]; drivers?: Record<string, number> };
    return {
      key: `cashdip:${scenarioId}:${run.inputsHash}`,
      body: {
        months: data.months.map((m) => ({ period: m.period, cash: m.cash, operating: m.operating, investing: m.investing, financing: m.financing, hires: m.hires })),
        opening_cash: (data.drivers as { opening?: { cash?: number } } | undefined)?.opening?.cash ?? 0,
        cash_out_period: data.cashOutPeriod ?? null,
        lowest_period: data.lowestCashPeriod ?? null,
        drivers: Object.fromEntries(Object.entries(data.drivers ?? {}).filter(([, value]) => typeof value === "number")),
        hires: plan.hires,
        one_offs: plan.oneOffs,
        financing: plan.financing,
      },
    };
  },
});

export const cashDip = action({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }): Promise<Explanation & { fixes: { area: string; text: Prose }[] }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    const input = await ctx.runQuery(internal.aiActions.cashDipInput, { scenarioId });
    if (!input) throw new ConvexError("The forecast is still updating. Try again in a moment.");
    return once(ctx, c, "cashDip", input.key, c.version, () => engine("/actions/cash-dip", input.body));
  },
});

// ---------- why does this differ from Xero ----------

export const mismatchInput = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx);
    const row = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", "reconciliation"))
      .order("desc")
      .first();
    if (!row) return null;
    const data = row.data as { status: string; differences?: Record<string, unknown>[] };
    return data.status === "match" || !data.differences?.length ? null : { key: `mismatch:${row._id}`, differences: data.differences };
  },
});

export const explainMismatch = action({
  args: {},
  handler: async (ctx): Promise<{ summary: Prose; items: { accountId: string; name: string; period: string; reason: Prose; fix: string }[] }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    const input = await ctx.runQuery(internal.aiActions.mismatchInput, {});
    if (!input) throw new ConvexError("Nothing differs from Xero right now.");
    return once(ctx, c, "explainMismatch", input.key, c.version, () =>
      engine("/actions/mismatch", { differences: input.differences, last_sync: c.lastSyncAt ? new Date(c.lastSyncAt).toISOString() : null, mode: c.mode }),
    );
  },
});

// ---------- what changed since the last sync ----------

export const digestInput = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx);
    const [after, before] = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", "statements"))
      .order("desc")
      .take(2);
    if (!after || !before) return null;
    const side = (row: Doc<"reportSnapshots">) => {
      const d = row.data as { asOf: string; measures: { cash: number }; pnl: { rows: { type: string; label: string; accountId?: string; values?: (number | null)[] }[] } };
      return {
        as_of: d.asOf,
        cash: d.measures.cash,
        rows: d.pnl.rows.filter((r) => r.type === "line" && r.values).map((r) => ({ accountId: r.accountId ?? r.label, label: r.label, value: r.values?.at(-1) ?? 0 })),
      };
    };
    return { key: `digest:${after._id}:${before._id}`, at: after.createdAt, before: side(before), after: side(after) };
  },
});

export const digest = action({
  args: {},
  handler: async (ctx): Promise<{ items: Prose[]; unchanged: boolean; first?: boolean; at?: number }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    const input = await ctx.runQuery(internal.aiActions.digestInput, {});
    if (!input) return { items: [], unchanged: true, first: true };
    const out = await once(ctx, c, "digest", input.key, c.version, () => engine<{ items: Prose[]; unchanged: boolean }>("/actions/digest", { before: input.before, after: input.after }));
    return { ...out, at: input.at };
  },
});

// ---------- unusual movements ----------

export const linesFor = internalQuery({
  args: { accountIds: v.array(v.string()), period: v.string() },
  handler: async (ctx, { accountIds, period }) => {
    const { org } = await requireOrg(ctx);
    const out: Record<string, Awaited<ReturnType<typeof lineRows>>> = {};
    for (const id of accountIds) {
      const account = await ctx.db
        .query("accounts")
        .withIndex("by_org_xero", (q) => q.eq("orgId", org._id).eq("xeroAccountId", id))
        .unique();
      const rows = await lineRows(ctx, org._id, id, period, account ? sign(account.accountClass, account.type) : 1, 200);
      out[id] = rows.sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents)).slice(0, 3);
    }
    return out;
  },
});

export const ledgerForOrg = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx);
    return ledgerInput(ctx, org._id);
  },
});

export type Anomaly = { accountId: string; name: string; kind: string; period: string; nowCents: number; typicalCents: number; reason: Prose | null };

export const anomalies = action({
  args: {},
  handler: async (ctx): Promise<Anomaly[]> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    if (!c.asOf) return [];
    const asOf = c.asOf;
    return once(ctx, c, "anomalies", `anomalies:${asOf}`, c.version, async () => {
      const ledger = await ctx.runQuery(internal.aiActions.ledgerForOrg, {});
      const { flags } = await engine<{ flags: Omit<Anomaly, "reason">[] }>("/actions/anomalies/detect", { accounts: ledger.accounts, balances: ledger.balances, as_of: asOf });
      if (!flags.length) return [];
      const lines = c.mode === "journals" ? await ctx.runQuery(internal.aiActions.linesFor, { accountIds: flags.map((f) => f.accountId), period: asOf }) : {};
      try {
        const { reasons } = await engine<{ reasons: { accountId: string; text: Prose }[] }>("/actions/anomalies/explain", { flags, lines });
        return flags.map((f) => ({ ...f, reason: reasons.find((r) => r.accountId === f.accountId)?.text ?? null }));
      } catch {
        // The flags are arithmetic and stand on their own; the reasons are a bonus.
        return flags.map((f) => ({ ...f, reason: null }));
      }
    });
  },
});

// ---------- payment reminder ----------

export const reminderInput = internalQuery({
  args: { contact: v.string() },
  handler: async (ctx, { contact }) => {
    const { org } = await requireOrg(ctx);
    const items = await importedOpenItems(ctx, org._id);
    return (items ?? []).filter((i) => i.kind === "receivable" && i.contact === contact).map((i) => ({ number: i.number, due_date: i.dueDate, amount_due_cents: i.amountDueCents }));
  },
});

export const reminder = action({
  args: { contact: v.string(), fresh: v.optional(v.boolean()) },
  handler: async (ctx, { contact, fresh }): Promise<{ subject: Prose; body: Prose[] }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    const asOf = c.imported ? monthEnd(c.asOf ?? "2026-01") : new Date().toISOString().slice(0, 10);
    return once(ctx, c, "reminder", `reminder:${contact}`, c.version, async () => {
      let items: { number: string; due_date: string; amount_due_cents: number }[] = [];
      if (c.imported) items = await ctx.runQuery(internal.aiActions.reminderInput, { contact });
      else if (c.connected) {
        const auth = await ctx.runAction(internal.xero.tokensFor, { orgId: c.orgId });
        if (!auth) throw new ConvexError("Reconnect Xero to read unpaid invoices.");
        const result = await engine<{ items?: typeof items; tokens?: Tokens }>("/xero/open-items", { tokens: auth.tokens, tenant_id: auth.tenantId, as_of: asOf, contact });
        await persistRotated(ctx, c.orgId, result.tokens);
        items = result.items ?? [];
      }
      if (!items.length) throw new ConvexError(`${contact} has no unpaid invoices.`);
      return engine("/actions/reminder", { company: c.orgName, contact, sender: c.who, as_of: asOf, items });
    }, fresh ?? false);
  },
});

// ---------- a downside case ----------

export const downsideInput = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx);
    const snapshot = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", "statements"))
      .order("desc")
      .first();
    const base = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .filter((q) => q.eq(q.field("isBase"), true))
      .first();
    const drivers = { ...((snapshot?.data as { drivers?: Record<string, unknown> } | undefined)?.drivers ?? {}), ...(base?.overrides ?? {}) };
    return { baseId: base?._id ?? null, drivers: Object.fromEntries(Object.entries(drivers).filter(([, value]) => typeof value === "number")) as Record<string, number> };
  },
});

export const downside = action({
  args: {},
  handler: async (ctx): Promise<{ baseId: Id<"scenarios"> | null; name: string; changes: { key: string; from: number; to: number; reason: Prose }[] }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    if (!c.asOf) throw new ConvexError("Add your figures first.");
    const asOf = c.asOf;
    const input = await ctx.runQuery(internal.aiActions.downsideInput, {});
    const out = await once(ctx, c, "downside", `downside:${asOf}`, c.version, async () => {
      const ledger = await ctx.runQuery(internal.aiActions.ledgerForOrg, {});
      return engine<{ name: string; changes: { key: string; from: number; to: number; reason: Prose }[] }>("/actions/downside", { accounts: ledger.accounts, balances: ledger.balances, as_of: asOf, drivers: input.drivers });
    });
    return { ...out, baseId: input.baseId };
  },
});

// ---------- a scenario from a sentence ----------

export type ParsedScenario = {
  hires: { role: string; salaryCents: number; count: number; startPeriod: string }[];
  oneOffs: { label: string; kind: "capex" | "income" | "expense"; amountCents: number; period: string }[];
  financing: { kind: "loan" | "equity" | "dividend"; amountCents: number; period: string }[];
  assumptions: { key: string; value: number }[];
  notUnderstood: string;
};

export const parseScenario = action({
  args: { text: v.string(), startPeriod: v.string() },
  handler: async (ctx, { text, startPeriod }): Promise<ParsedScenario> => {
    const words = text.trim();
    if (!words) throw new ConvexError("Describe the change first.");
    if (words.length > 1000) throw new ConvexError("Keep it under 1,000 characters.");
    if (!/^\d{4}-\d{2}$/.test(startPeriod)) throw new ConvexError("The forecast isn't ready yet.");
    const c = await ctx.runQuery(internal.aiActions.context, {});
    return once(ctx, c, "parseScenario", null, c.version, () => engine<ParsedScenario>("/actions/parse-scenario", { text: words, start_period: startPeriod }));
  },
});

// ---------- help with a CSV that doesn't fit ----------

export const importMap = action({
  args: { file: v.union(v.literal("accounts"), v.literal("journals")), headers: v.array(v.string()), sample: v.array(v.array(v.string())), unknownTypes: v.array(v.string()), allowedTypes: v.array(v.string()) },
  handler: async (ctx, args): Promise<{ columns: Record<string, string>; types: Record<string, string>; note: string }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    return once(ctx, c, "importMap", null, c.version, () =>
      engine("/actions/import-map", {
        file: args.file,
        headers: args.headers.slice(0, 60).map((h) => h.slice(0, 80)),
        sample: args.sample.slice(0, 5).map((r) => r.slice(0, 20).map((cell) => cell.slice(0, 60))),
        unknown_types: args.unknownTypes.slice(0, 60),
        allowed_types: args.allowedTypes.slice(0, 60),
      }),
    );
  },
});

// ---------- a name for a scenario ----------

export const nameInput = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }) => {
    const { org } = await requireOrg(ctx);
    const scenario = await ctx.db.get(scenarioId);
    if (!scenario || scenario.orgId !== org._id || scenario.isBase) return null;
    const parent = scenario.parentId ? await ctx.db.get(scenario.parentId) : null;
    const plan = [
      ...scenario.hires.map((h) => `${h.count} × ${h.role} from ${h.startPeriod}`),
      ...scenario.oneOffs.map((o) => `${o.kind} ${o.label} in ${o.period}`),
      ...scenario.financing.map((f) => `${f.kind} in ${f.period}`),
      ...Object.entries(scenario.overrides).map(([k, value]) => `${k} set to ${value}`),
    ];
    return { key: `name:${scenarioId}:${scenario.updatedAt}`, parent: parent?.name ?? "Base case", changes: plan.length ? plan.join("; ") : describe(scenario) };
  },
});

export const nameScenario = action({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, { scenarioId }): Promise<{ names: string[] }> => {
    const c = await ctx.runQuery(internal.aiActions.context, {});
    const input = await ctx.runQuery(internal.aiActions.nameInput, { scenarioId });
    if (!input) throw new ConvexError("Only branches can be renamed.");
    if (input.changes === "no changes yet") throw new ConvexError("Change something in this scenario first, then ask for a name.");
    return once(ctx, c, "nameScenario", input.key, c.version, () => engine("/actions/name-scenario", { parent: input.parent, changes: input.changes }));
  },
});

// ---------- metering ----------

export const usage = internalQuery({
  args: { orgId: v.id("organizations"), since: v.number() },
  handler: async (ctx, { orgId, since }) => {
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_org_at", (q) => q.eq("orgId", orgId).gte("at", since))
      .collect();
    const byAction: Record<string, number> = {};
    for (const row of rows) byAction[row.action] = (byAction[row.action] ?? 0) + 1;
    return { total: rows.length, byAction };
  },
});
