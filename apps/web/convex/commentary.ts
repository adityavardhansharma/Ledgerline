import type { FunctionReturnType } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query, type ActionCtx, type MutationCtx, type QueryCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { currentOrg, requireOrg } from "./lib/auth";
import { EngineError, engine } from "./lib/engine";
import { toNumber } from "./lib/money";
import { limitError } from "./lib/plan";
import { persistRotated } from "./lib/tokens";
import { ledgerInput } from "./reports";
import type { Tokens } from "./xero";

/**
 * Board-pack commentary. The engine builds a facts pack from the ledger, the base-case forecast and its
 * branches, the plan, what customers owe and who bought, and writes the pack's sections citing those facts.
 * Management notes add context only the team knows. Drafts are versions: redrafting a section, editing the
 * words or restoring an older version makes a new draft; accepting one fixes it for the board.
 */

const tone = v.union(v.literal("board"), v.literal("investor"), v.literal("brief"));
const length = v.union(v.literal("short"), v.literal("standard"), v.literal("detailed"));
const section = v.union(
  v.literal("headline"),
  v.literal("performance"),
  v.literal("cash"),
  v.literal("outlook"),
  v.literal("risks"),
  v.literal("decisions"),
  v.literal("questions"),
);
export type Section = Infer<typeof section>;
export type Citation = { text: string; source: string; fact?: string };
export type Prose = (string | Citation)[];
export type Risk = { level: "red" | "amber" | "green"; title: string; detail: Prose };
export type Question = { question: Prose; answer: Prose };
export type Sections = {
  headline?: Prose[];
  performance?: Prose[];
  cash?: Prose[];
  outlook?: Prose[];
  risks?: Risk[];
  decisions?: Prose[];
  questions?: Question[];
};
export type FactRow = { id: string; label: string; value: string; source: string; group: string };

const REVENUE_TYPES = new Set(["REVENUE", "SALES"]);
const periodAdd = (period: string, months: number) => {
  const index = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

export function describe(s: Doc<"scenarios">) {
  const words = ["", "one", "two", "three"];
  const n = (count: number, one: string, many: string) => (count ? `${words[count] ?? "several"} ${count === 1 ? one : many}` : "");
  const parts = [n(s.hires.reduce((t, h) => t + h.count, 0), "hire", "hires"), n(s.oneOffs.length, "one-off", "one-offs")];
  for (const f of s.financing) parts.push(f.kind === "loan" ? "a loan" : f.kind === "equity" ? "an equity raise" : "a dividend");
  parts.push(n(Object.keys(s.overrides).length, "changed assumption", "changed assumptions"));
  return parts.filter(Boolean).join(", ") || "no changes yet";
}

async function latestRun(ctx: QueryCtx, scenarioId: Id<"scenarios">, version: number) {
  const run = await ctx.db
    .query("forecastRuns")
    .withIndex("by_scenario", (q) => q.eq("scenarioId", scenarioId))
    .order("desc")
    .first();
  return run && run.actualsVersion === version ? (run.data as Record<string, unknown>) : null;
}

async function snapshot(ctx: QueryCtx, orgId: Id<"organizations">, kind: "ageing" | "reconciliation") {
  const row = await ctx.db
    .query("reportSnapshots")
    .withIndex("by_org_kind", (q) => q.eq("orgId", orgId).eq("kind", kind))
    .order("desc")
    .first();
  return row ? (row.data as Record<string, unknown>) : null;
}

/** Sales by customer from imported journal lines that name their contact. */
async function importedCustomers(ctx: QueryCtx, orgId: Id<"organizations">, period: string) {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const month = new Map<string, number>();
  const quarter = new Map<string, number>();
  const prior = new Set<string>();
  let named = false;
  for (const account of accounts.filter((a) => REVENUE_TYPES.has(a.type.toUpperCase()))) {
    for (const p of [periodAdd(period, -2), periodAdd(period, -1), period]) {
      const lines = await ctx.db
        .query("ledgerLines")
        .withIndex("by_org_account_period", (q) => q.eq("orgId", orgId).eq("xeroAccountId", account.xeroAccountId).eq("period", p))
        .take(2000);
      for (const line of lines) {
        if (!line.contact) continue;
        named = true;
        const cents = -toNumber(line.netCents);
        quarter.set(line.contact, (quarter.get(line.contact) ?? 0) + cents);
        if (p === period) month.set(line.contact, (month.get(line.contact) ?? 0) + cents);
        else prior.add(line.contact);
      }
    }
  }
  if (!named) return null;
  const rows = (m: Map<string, number>) => [...m].filter(([, value]) => value > 0).map(([contact, value]) => ({ contact, value }));
  return { month: rows(month), quarter: rows(quarter), prior: [...prior] };
}

/** Everything the engine needs to build the facts pack, for the signed-in organisation's latest month. */
export const gather = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    if (!org.asOf) return null;
    const period = org.asOf;
    const ledger = await ledgerInput(ctx, org._id);
    if (!ledger.balances.length) return null;
    const scenarios = await ctx.db
      .query("scenarios")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const base = scenarios.find((s) => s.isBase) ?? null;
    const baseRun = base ? await latestRun(ctx, base._id, org.actualsVersion) : null;
    const branches = [];
    for (const s of scenarios.filter((x) => !x.isBase).slice(0, 3)) {
      const run = await latestRun(ctx, s._id, org.actualsVersion);
      if (!run) continue;
      const months = (run.months as { cash: number }[] | undefined) ?? [];
      branches.push({ name: s.name, changes: describe(s), cashOutPeriod: run.cashOutPeriod ?? null, runwayMonths: run.runwayMonths ?? null, cash12: months[11]?.cash ?? null });
    }
    const plans = await ctx.db
      .query("plans")
      .withIndex("by_org_madeAt", (q) => q.eq("orgId", org._id).lt("madeAt", period))
      .order("desc")
      .take(3);
    const planned = plans.map((p) => ({ madeAt: p.madeAt, month: p.months.find((m) => m.period === period) })).find((p) => p.month);
    const notes = await ctx.db
      .query("boardNotes")
      .withIndex("by_org_period", (q) => q.eq("orgId", org._id).eq("period", period))
      .first();
    const latest = await ctx.db
      .query("commentaries")
      .withIndex("by_org_period", (q) => q.eq("orgId", org._id).eq("period", period))
      .order("desc")
      .first();
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const imported = org.source === "csv" || org.source === "sample";
    return {
      orgId: org._id,
      who: who.name,
      period,
      baseScenarioId: base?._id ?? null,
      xero: !imported && connection?.status === "connected",
      customers: imported ? await importedCustomers(ctx, org._id, period) : null,
      notes: notes?.text ?? "",
      latest: latest ? { sections: (latest.sections ?? null) as Sections | null, tone: latest.tone ?? null, length: latest.length ?? null } : null,
      board: {
        accounts: ledger.accounts,
        balances: ledger.balances,
        fy_start_month: org.fyStartMonth,
        as_of: period,
        forecast: baseRun
          ? {
              months: ((baseRun.months as Record<string, unknown>[] | undefined) ?? []).map((m) => ({ period: m.period, revenue: m.revenue, ebitda: m.ebitda, cash: m.cash })),
              runwayMonths: baseRun.runwayMonths ?? null,
              cashOutPeriod: baseRun.cashOutPeriod ?? null,
              lowestCash: baseRun.lowestCash ?? null,
              lowestCashPeriod: baseRun.lowestCashPeriod ?? null,
              sensitivity: baseRun.sensitivity ?? null,
            }
          : null,
        scenarios: branches,
        ageing: imported ? null : await snapshot(ctx, org._id, "ageing"),
        reconciliation: imported ? null : await snapshot(ctx, org._id, "reconciliation"),
        plan: planned?.month ? { madeAt: planned.madeAt, revenue: planned.month.revenue, ebitda: planned.month.ebitda, cash: planned.month.cash } : null,
      },
    };
  },
});

type Gathered = NonNullable<FunctionReturnType<typeof internal.commentary.gather>>;

/** The facts the engine needs, running the base-case forecast if it's missing, plus sales by customer. */
async function prepare(ctx: ActionCtx): Promise<Gathered & { payload: Record<string, unknown> }> {
  let input: Gathered | null = await ctx.runQuery(internal.commentary.gather, {});
  if (!input) throw new ConvexError("Add your figures before drafting commentary: sync Xero, import a CSV or load the sample company.");
  if (!input.board.forecast && input.baseScenarioId) {
    try {
      await ctx.runAction(api.forecast.run, { scenarioId: input.baseScenarioId });
      input = (await ctx.runQuery(internal.commentary.gather, {})) ?? input;
    } catch {
      // The commentary still works without the outlook.
    }
  }
  let customers: unknown = input.customers;
  if (input.xero) {
    try {
      const auth = await ctx.runAction(internal.xero.tokensFor, { orgId: input.orgId });
      if (auth) {
        const result = await engine<{ month: unknown; quarter: unknown; prior: unknown; tokens?: Tokens }>("/xero/customer-revenue", {
          tokens: auth.tokens,
          tenant_id: auth.tenantId,
          period: input.period,
        });
        await persistRotated(ctx, input.orgId, result.tokens);
        customers = { month: result.month, quarter: result.quarter, prior: result.prior };
      }
    } catch {
      // Sales by customer is a nice-to-have; Xero being busy shouldn't stop the draft.
    }
  }
  return { ...input, payload: { ...input.board, customers } };
}

function plain(err: unknown): string {
  if (err instanceof EngineError) {
    console.error("engine rejected the commentary", err.status, JSON.stringify(err.body).slice(0, 500));
    if (err.status === 422) return "The draft didn't pass its checks twice in a row. Try again, or shorten your notes.";
    return "The writing service didn't answer. Try again in a moment.";
  }
  throw err;
}

export const draft = action({
  args: { tone: v.optional(tone), length: v.optional(length), section: v.optional(section) },
  handler: async (ctx, args): Promise<{ id: Id<"commentaries"> }> => {
    // Out of AI actions: the saved drafts stay on the page; only a new one waits for the reset.
    const allowance = await ctx.runQuery(internal.billing.left, { meter: "actions" });
    if (allowance.left <= 0) throw limitError("actions", allowance.resetsAt, null, allowance.limit);
    const input = await prepare(ctx);
    const current = input.latest?.sections ?? null;
    if (args.section && !current) throw new ConvexError("Draft the whole commentary first, then redraft a section.");
    const chosenTone = args.tone ?? input.latest?.tone ?? "board";
    const chosenLength = args.length ?? input.latest?.length ?? "standard";
    let result: { sections: Sections; facts: FactRow[] };
    try {
      result = await engine("/commentary/draft", {
        ...input.payload,
        notes: input.notes,
        tone: chosenTone,
        length: chosenLength,
        section: args.section ?? null,
        current: args.section ? current : null,
      });
    } catch (err) {
      throw new ConvexError(plain(err));
    }
    const sections = args.section ? { ...current, [args.section]: result.sections[args.section] } : result.sections;
    const id: Id<"commentaries"> = await ctx.runMutation(internal.commentary.save, {
      orgId: input.orgId,
      period: input.period,
      sections,
      facts: result.facts,
      tone: chosenTone,
      length: chosenLength,
      createdBy: input.who,
    });
    return { id };
  },
});

export const save = internalMutation({
  args: { orgId: v.id("organizations"), period: v.string(), sections: v.any(), facts: v.any(), tone: v.string(), length: v.string(), createdBy: v.string() },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("commentaries", { ...args, status: "draft", createdAt: Date.now() });
    await ctx.db.insert("aiUsage", { orgId: args.orgId, action: "commentary", by: args.createdBy, at: Date.now() });
    await prune(ctx, args.orgId, args.period);
    return id;
  },
});

export const logAsk = internalMutation({
  args: { orgId: v.id("organizations"), by: v.string() },
  handler: async (ctx, { orgId, by }) => {
    await ctx.db.insert("aiUsage", { orgId, action: "chat", by, at: Date.now() });
  },
});

/** Keep the twenty newest versions of a month's commentary, and every accepted one. */
async function prune(ctx: MutationCtx, orgId: Id<"organizations">, period: string) {
  const rows = await ctx.db
    .query("commentaries")
    .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("period", period))
    .order("desc")
    .collect();
  for (const row of rows.slice(20)) if (row.status !== "accepted") await ctx.db.delete(row._id);
}

export const accept = mutation({
  args: { id: v.id("commentaries") },
  handler: async (ctx, { id }) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    const row = await ctx.db.get(id);
    if (!row || row.orgId !== org._id) throw new ConvexError("Commentary not found.");
    await ctx.db.patch(id, { status: "accepted", acceptedBy: who.name });
    await audit(ctx, org._id, { actor: who.name, action: "accepted commentary for", target: row.period, icon: "sparkle", tone: "brand" });
  },
});

const FIGURE = /[\d€%]/;
const key = (c: { text: string; source: string }) => `${c.text}\u0000${c.source}`;
const isCitation = (x: unknown): x is Citation => Boolean(x && typeof x === "object" && typeof (x as Citation).text === "string" && typeof (x as Citation).source === "string");

function citations(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((x) => citations(x, out));
  else if (isCitation(value)) out.add(key(value));
  else if (value && typeof value === "object") Object.values(value).forEach((x) => citations(x, out));
  return out;
}

/** An edit keeps its words free of figures, and keeps only citations the draft already made. */
function checkEdit(value: unknown, allowed: Set<string>): void {
  if (typeof value === "string") {
    if (FIGURE.test(value)) throw new ConvexError("Figures can't be typed in: every number is a citation, so it always matches the accounts.");
  } else if (Array.isArray(value)) value.forEach((x) => checkEdit(x, allowed));
  else if (isCitation(value)) {
    if (!allowed.has(key(value))) throw new ConvexError("A citation was changed. Figures come from the accounts and can't be edited.");
  } else if (value && typeof value === "object") {
    for (const [k, x] of Object.entries(value)) if (k !== "level") checkEdit(x, allowed);
  }
}

/** Save edited words for one section as a new draft. Citations can be removed but never altered or added. */
export const editSection = mutation({
  args: { id: v.id("commentaries"), section, value: v.any() },
  handler: async (ctx, { id, section: name, value }) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    const row = await ctx.db.get(id);
    if (!row || row.orgId !== org._id || !row.sections) throw new ConvexError("Commentary not found.");
    if (!Array.isArray(value)) throw new ConvexError("That section couldn't be saved.");
    checkEdit(value, citations(row.sections));
    const { _id, _creationTime, status: _status, acceptedBy: _acceptedBy, ...rest } = row;
    const next = await ctx.db.insert("commentaries", {
      ...rest,
      sections: { ...(row.sections as Sections), [name]: value },
      status: "draft",
      createdAt: Date.now(),
      editedBy: who.name,
    });
    await prune(ctx, org._id, row.period);
    return next;
  },
});

/** Make an older version the current draft again. */
export const restore = mutation({
  args: { id: v.id("commentaries") },
  handler: async (ctx, { id }) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    const row = await ctx.db.get(id);
    if (!row || row.orgId !== org._id) throw new ConvexError("Commentary not found.");
    const { _id, _creationTime, status: _status, acceptedBy: _acceptedBy, ...rest } = row;
    const next = await ctx.db.insert("commentaries", { ...rest, status: "draft", createdAt: Date.now(), editedBy: who.name });
    await prune(ctx, org._id, row.period);
    return next;
  },
});

function shape(row: Doc<"commentaries">) {
  return {
    id: row._id,
    period: row.period,
    sections: (row.sections ?? null) as Sections | null,
    paragraphs: (row.paragraphs ?? null) as Prose[] | null,
    facts: (row.facts ?? []) as FactRow[],
    tone: row.tone ?? "board",
    length: row.length ?? "standard",
    status: row.status,
    createdAt: row.createdAt,
    createdBy: row.createdBy ?? null,
    editedBy: row.editedBy ?? null,
    acceptedBy: row.acceptedBy ?? null,
  };
}
export type Commentary = ReturnType<typeof shape>;

export const latest = query({
  args: { period: v.optional(v.string()) },
  handler: async (ctx, { period }) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    const target = period ?? found.org.asOf;
    if (!target) return null;
    const row = await ctx.db
      .query("commentaries")
      .withIndex("by_org_period", (q) => q.eq("orgId", found.org._id).eq("period", target))
      .order("desc")
      .first();
    return row ? shape(row) : null;
  },
});

export const history = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found?.org.asOf) return [];
    const period = found.org.asOf;
    const rows = await ctx.db
      .query("commentaries")
      .withIndex("by_org_period", (q) => q.eq("orgId", found.org._id).eq("period", period))
      .order("desc")
      .take(20);
    return rows.map(shape);
  },
});

export const notes = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found?.org.asOf) return null;
    const period = found.org.asOf;
    const row = await ctx.db
      .query("boardNotes")
      .withIndex("by_org_period", (q) => q.eq("orgId", found.org._id).eq("period", period))
      .first();
    return { period, text: row?.text ?? "", updatedBy: row?.updatedBy ?? null, updatedAt: row?.updatedAt ?? null };
  },
});

export const saveNotes = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    if (!org.asOf) throw new ConvexError("Add your figures first.");
    if (text.length > 4000) throw new ConvexError("Keep notes under 4,000 characters.");
    const period = org.asOf;
    const row = await ctx.db
      .query("boardNotes")
      .withIndex("by_org_period", (q) => q.eq("orgId", org._id).eq("period", period))
      .first();
    const fields = { text, updatedBy: who.name, updatedAt: Date.now() };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("boardNotes", { orgId: org._id, period, ...fields });
  },
});

/** Answer a question about this month's figures, citing them, with the conversation so far as context. */
export const ask = action({
  args: { question: v.string(), history: v.optional(v.array(v.object({ question: v.string(), answer: v.string() }))) },
  handler: async (ctx, { question, history }): Promise<{ answer: Prose[] }> => {
    const text = question.trim();
    if (!text) throw new ConvexError("Ask a question about the figures.");
    if (text.length > 500) throw new ConvexError("Keep questions under 500 characters.");
    const allowance = await ctx.runQuery(internal.billing.left, { meter: "chats" });
    if (allowance.left <= 0) throw limitError("chats", allowance.resetsAt, null, allowance.limit);
    const input = await prepare(ctx);
    try {
      const answer = await engine<{ answer: Prose[] }>("/commentary/ask", { ...input.payload, question: text, notes: input.notes, history: (history ?? []).slice(-4) });
      await ctx.runMutation(internal.commentary.logAsk, { orgId: input.orgId, by: input.who });
      return answer;
    } catch (err) {
      throw new ConvexError(plain(err));
    }
  },
});
