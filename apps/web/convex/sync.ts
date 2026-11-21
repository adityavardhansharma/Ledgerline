/**
 * The Xero sync state machine. Each step is one short, retryable action. Which steps run depends on the
 * connection's mode, decided from the scopes Xero granted:
 *
 *   journals: accounts → journals (one page per step) → invoices → reports → reconcile → done
 *   reports:  accounts → balances (six month-end trial balances per step) → cash → invoices → reports → reconcile → done
 *
 * Journals are append-only in Xero, so journals mode needs one cursor (the last journal number) and stores
 * every page idempotently by journal ID. Reports mode rereads the last three months each night (late postings
 * land there) and the whole history on the first sync, after a mode change, or when the check against Xero
 * finds a difference.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation, internalQuery, type MutationCtx, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { currentOrg, requireOrg } from "./lib/auth";
import { EngineError, engine } from "./lib/engine";
import { currentPeriod, periodAdd, periodOf } from "./lib/money";
import { persistRotated } from "./lib/tokens";
import { type Tokens, modeFor } from "./xero";

const MAX_ATTEMPTS = 3;
const HISTORY_MONTHS = 24; // plus the current month and the opening position before it
const BALANCES_PER_STEP = 6;

export interface EngineJournal {
  xero_journal_id: string;
  journal_number: number;
  date: string;
  source_type: string;
  reference: string;
  lines: { xero_account_id: string; net_cents: number; description: string; contact?: string }[];
}

// ---------- starting a sync ----------

export const enqueue = internalMutation({
  args: { orgId: v.id("organizations"), trigger: v.string(), full: v.optional(v.boolean()) },
  handler: async (ctx, { orgId, trigger, full }) => {
    const active = await ctx.db
      .query("syncRuns")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .first();
    if (active && ["queued", "running", "backingOff"].includes(active.status)) {
      const connection = await ctx.db
        .query("xeroConnections")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first();
      if (connection) await ctx.db.patch(connection._id, { rerunRequested: true });
      return active._id;
    }
    const previous = await ctx.db
      .query("syncRuns")
      .withIndex("by_org_status", (q) => q.eq("orgId", orgId).eq("status", "done"))
      .order("desc")
      .first();
    const runId = await ctx.db.insert("syncRuns", {
      orgId,
      trigger,
      phase: "accounts",
      status: "queued",
      pagesDone: 0,
      pagesEstimate: previous && previous.trigger === "First sync" ? previous.pagesDone : undefined,
      journalsStored: 0,
      attempts: 0,
      startedAt: Date.now(),
      full: full || undefined,
    });
    await ctx.scheduler.runAfter(0, internal.sync.runStep, { runId });
    return runId;
  },
});

export const request = mutation({
  args: {},
  handler: async (ctx) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!connection || connection.status !== "connected") throw new ConvexError("Connect Xero first.");
    await audit(ctx, org._id, { actor: who.name, action: "started a sync of", target: connection.tenantName, icon: "sync" });
    await ctx.scheduler.runAfter(0, internal.sync.enqueue, { orgId: org._id, trigger: "Manual" });
  },
});

// ---------- the step runner ----------

export const runStep = internalAction({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.runQuery(internal.sync.getRun, { runId });
    if (!run || ["done", "failed", "reauth", "needsReview"].includes(run.status)) return;
    // Everything that can throw is inside the try, so a failure always retries or finishes the run
    // instead of leaving it "running" with nothing scheduled.
    try {
      const auth = await ctx.runAction(internal.xero.tokensFor, { orgId: run.orgId });
      if (!auth) {
        await ctx.runMutation(internal.sync.finish, { runId, status: "reauth", error: "Xero is not connected." });
        return;
      }
      await ctx.runMutation(internal.sync.patchRun, { runId, patch: { status: "running", retryAt: undefined, touchedAt: Date.now() } });
      const tenant = { tokens: auth.tokens, tenant_id: auth.tenantId };
      switch (run.phase) {
        case "accounts":
          await stepAccounts(ctx, run, tenant);
          break;
        case "journals":
          await stepJournals(ctx, run, tenant);
          break;
        case "balances":
          await stepBalances(ctx, run, tenant);
          break;
        case "cash":
          await stepCash(ctx, run, tenant);
          break;
        case "invoices":
          await stepInvoices(ctx, run, tenant);
          break;
        case "reports":
          await ctx.runAction(internal.reports.rebuild, { orgId: run.orgId });
          await ctx.runMutation(internal.sync.advance, { runId, phase: "reconcile" });
          break;
        case "reconcile":
          await stepReconcile(ctx, run, tenant);
          break;
        default:
          return;
      }
      await ctx.scheduler.runAfter(0, internal.sync.runStep, { runId });
    } catch (err) {
      await handleFailure(ctx, run, err);
    }
  },
});

type Ctx = ActionCtx;
type Tenant = { tokens: Tokens; tenant_id: string };

async function stepAccounts(ctx: Ctx, run: Doc<"syncRuns">, tenant: Tenant) {
  const result = await engine<{ accounts: Record<string, string>[]; tokens?: Tokens }>("/xero/accounts", tenant);
  await persistRotated(ctx, run.orgId, result.tokens);
  // Figures imported from a file are replaced, not mixed with Xero's.
  if (await ctx.runMutation(internal.sync.claimForXero, { orgId: run.orgId })) {
    let more = true;
    while (more) more = await ctx.runMutation(internal.sync.clearBatch, { orgId: run.orgId, accounts: true });
  }
  await ctx.runMutation(internal.sync.storeAccounts, { orgId: run.orgId, accounts: result.accounts.map(toAccount) });

  // A different Xero organisation was connected: clear the previous one's figures and chart first.
  const pending = await ctx.runQuery(internal.xero.connectionFor, { orgId: run.orgId });
  if (pending?.resetPending) {
    let more = true;
    while (more) more = await ctx.runMutation(internal.sync.clearBatch, { orgId: run.orgId, accounts: true, authored: true });
    await ctx.runMutation(internal.sync.resetDone, { orgId: run.orgId });
    await ctx.runMutation(internal.sync.storeAccounts, { orgId: run.orgId, accounts: result.accounts.map(toAccount) });
  }

  // Journals or trial balances, from what Xero granted. A change (journal access added or removed)
  // rebuilds the figures from scratch in the new mode rather than mixing the two.
  const before = await ctx.runQuery(internal.xero.connectionFor, { orgId: run.orgId });
  const mode = modeFor(before?.scopes);
  if (before?.mode && before.mode !== mode) {
    let more = true;
    while (more) more = await ctx.runMutation(internal.sync.clearBatch, { orgId: run.orgId, accounts: false });
  }
  await ctx.runMutation(internal.sync.setMode, { runId: run._id, mode });
  if (mode === "reports") {
    await ctx.runMutation(internal.sync.startBalances, { runId: run._id });
    return;
  }

  // The Demo Company resets every 28 days. If the journal we stopped at is gone, start again from zero.
  const connection = await ctx.runQuery(internal.xero.connectionFor, { orgId: run.orgId });
  if (connection && connection.lastJournalNumber > 0 && connection.lastJournalId) {
    const check = await engine<{ ok: boolean; tokens?: Tokens }>("/xero/journal-check", {
      ...tenant,
      tokens: result.tokens ?? tenant.tokens,
      journal_number: connection.lastJournalNumber,
      xero_journal_id: connection.lastJournalId,
    });
    await persistRotated(ctx, run.orgId, check.tokens);
    if (!check.ok) {
      let more = true;
      while (more) more = await ctx.runMutation(internal.sync.resetBatch, { orgId: run.orgId });
    }
  }
  await ctx.runMutation(internal.sync.advance, { runId: run._id, phase: "journals" });
}

function toAccount(a: Record<string, string>) {
  return {
    xeroAccountId: a.xero_account_id,
    code: a.code ?? "",
    name: a.name ?? "",
    type: a.type ?? "",
    accountClass: a.account_class ?? "",
    systemAccount: a.system_account ?? "",
    status: a.status ?? "ACTIVE",
  };
}

async function stepJournals(ctx: Ctx, run: Doc<"syncRuns">, tenant: Tenant) {
  const connection = await ctx.runQuery(internal.xero.connectionFor, { orgId: run.orgId });
  const offset = connection?.lastJournalNumber ?? 0;
  const result = await engine<{ journals: EngineJournal[]; nextOffset: number; fullPage: boolean; tokens?: Tokens }>("/xero/journals", {
    ...tenant,
    offset,
  });
  await persistRotated(ctx, run.orgId, result.tokens);
  await ctx.runMutation(internal.sync.storePage, { runId: run._id, orgId: run.orgId, journals: result.journals });
  if (!result.fullPage) await ctx.runMutation(internal.sync.advance, { runId: run._id, phase: "invoices" });
}

async function stepBalances(ctx: Ctx, run: Doc<"syncRuns">, tenant: Tenant) {
  const now = currentPeriod();
  const periods: string[] = [];
  for (let p = run.cursor ?? now; p <= now && periods.length < BALANCES_PER_STEP; p = periodAdd(p, 1)) periods.push(p);
  const input = await ctx.runQuery(internal.sync.balancesInput, { orgId: run.orgId });
  const opening = run.full && periods[0] === input.historyFrom ? periods[0] : null;
  const result = await engine<{
    periods: { period: string; lines: { xero_account_id: string; net_cents: number }[] }[];
    syntheticAccounts: Record<string, string>[];
    tokens?: Tokens;
  }>("/xero/trial-balances", {
    ...tenant,
    periods,
    opening_period: opening,
    retained_earnings_id: input.retainedEarningsId,
    today: new Date().toISOString().slice(0, 10),
  });
  await persistRotated(ctx, run.orgId, result.tokens);
  const last = periods[periods.length - 1];
  await ctx.runMutation(internal.sync.storeBalances, {
    runId: run._id,
    orgId: run.orgId,
    periods: result.periods,
    accounts: result.syntheticAccounts.map(toAccount),
    dropBefore: opening ?? undefined,
    next: last >= now ? undefined : periodAdd(last, 1),
  });
}

async function stepCash(ctx: Ctx, run: Doc<"syncRuns">, tenant: Tenant) {
  const from = `${periodAdd(currentPeriod(), -5)}-01`;
  const to = new Date().toISOString().slice(0, 10);
  const input = await ctx.runQuery(internal.reports.engineInput, { orgId: run.orgId });
  const result = await engine<{ days: { date: string; net_cents: number }[]; tokens?: Tokens }>("/xero/daily-cash", {
    ...tenant,
    accounts: input.accounts,
    date_from: from,
    date_to: to,
  });
  await persistRotated(ctx, run.orgId, result.tokens);
  await ctx.runMutation(internal.sync.storeDailyCash, { orgId: run.orgId, from, to, days: result.days });
  await ctx.runMutation(internal.sync.advance, { runId: run._id, phase: "invoices" });
}

async function stepInvoices(ctx: Ctx, run: Doc<"syncRuns">, tenant: Tenant) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await engine<{ ageing: unknown; tokens?: Tokens }>("/xero/open-items", { ...tenant, as_of: today });
  await persistRotated(ctx, run.orgId, result.tokens);
  await ctx.runMutation(internal.reports.storeSnapshot, { orgId: run.orgId, kind: "ageing", data: { asOf: today, ...(result.ageing as object) } });
  await ctx.runMutation(internal.sync.advance, { runId: run._id, phase: "reports" });
}

async function stepReconcile(ctx: Ctx, run: Doc<"syncRuns">, tenant: Tenant) {
  const input = await ctx.runQuery(internal.reports.engineInput, { orgId: run.orgId });
  const result = await engine<{ status: "match" | "mismatch"; tokens?: Tokens } & Record<string, unknown>>("/reconcile", {
    ...tenant,
    accounts: input.accounts,
    balances: input.balances,
    as_of: input.asOf,
    months: 12,
    fy_start_month: input.fyStartMonth,
  });
  await persistRotated(ctx, run.orgId, result.tokens);
  const { tokens: _tokens, ...data } = result;
  await ctx.runMutation(internal.reports.storeSnapshot, { orgId: run.orgId, kind: "reconciliation", data: { ...data, checkedAt: Date.now(), asOf: input.asOf } });
  await ctx.runMutation(internal.sync.finish, { runId: run._id, status: result.status === "match" ? "done" : "needsReview" });
  // An incremental read only covers recent months; a difference usually means an older month changed.
  if (result.status !== "match" && run.mode === "reports" && !run.full) {
    await ctx.scheduler.runAfter(1000, internal.sync.enqueue, { orgId: run.orgId, trigger: "Full refresh", full: true });
  }
}

async function handleFailure(ctx: Ctx, run: Doc<"syncRuns">, err: unknown) {
  if (err instanceof EngineError && err.status === 429) {
    const retryAfter = Math.max(5, err.retryAfter);
    await ctx.runMutation(internal.sync.patchRun, {
      runId: run._id,
      patch: { status: "backingOff", retryAt: Date.now() + retryAfter * 1000, error: `Xero rate limit reached; retrying in ${retryAfter}s.` },
    });
    await ctx.scheduler.runAfter(retryAfter * 1000, internal.sync.runStep, { runId: run._id });
    return;
  }
  if (err instanceof EngineError && err.needsReauth) {
    await ctx.runMutation(internal.xero.markExpired, { orgId: run.orgId });
    await ctx.runMutation(internal.sync.finish, { runId: run._id, status: "reauth", error: "Xero access expired. Reconnect to resume." });
    return;
  }
  const message = err instanceof EngineError ? String(err.body.message ?? err.message) : err instanceof Error ? err.message : String(err);
  const attempts = run.attempts + 1;
  if (attempts >= MAX_ATTEMPTS || (err instanceof EngineError && err.status === 422)) {
    await ctx.runMutation(internal.sync.finish, { runId: run._id, status: "failed", error: message.slice(0, 500) });
    return;
  }
  const delay = 5000 * 2 ** (attempts - 1);
  await ctx.runMutation(internal.sync.patchRun, { runId: run._id, patch: { attempts, status: "backingOff", retryAt: Date.now() + delay, error: message.slice(0, 500) } });
  await ctx.scheduler.runAfter(delay, internal.sync.runStep, { runId: run._id });
}

// ---------- writes ----------

export const getRun = internalQuery({ args: { runId: v.id("syncRuns") }, handler: (ctx, { runId }) => ctx.db.get(runId) });

export const patchRun = internalMutation({
  args: { runId: v.id("syncRuns"), patch: v.any() },
  handler: async (ctx, { runId, patch }) => {
    await ctx.db.patch(runId, patch);
  },
});

export const advance = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    phase: v.union(v.literal("journals"), v.literal("balances"), v.literal("cash"), v.literal("invoices"), v.literal("reports"), v.literal("reconcile")),
  },
  handler: async (ctx, { runId, phase }) => {
    await ctx.db.patch(runId, { phase, attempts: 0, error: undefined, touchedAt: Date.now() });
  },
});

export const resetDone = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (connection) await ctx.db.patch(connection._id, { resetPending: false });
  },
});

export const setMode = internalMutation({
  args: { runId: v.id("syncRuns"), mode: v.union(v.literal("journals"), v.literal("reports")) },
  handler: async (ctx, { runId, mode }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    await ctx.db.patch(runId, { mode });
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .first();
    if (!connection || connection.mode === mode) return;
    const switched = Boolean(connection.mode);
    await ctx.db.patch(connection._id, { mode, historyFrom: undefined, balancesThrough: undefined, ...(switched ? { lastJournalNumber: 0, lastJournalId: undefined, journalsStored: 0 } : {}) });
    if (switched) {
      await audit(ctx, run.orgId, {
        actor: "Ledgerline",
        action: mode === "journals" ? "gained journal access to" : "lost journal access to",
        target: connection.tenantName,
        detail: mode === "journals" ? "Rebuilding from every journal line" : "Rebuilding from monthly trial balances",
        icon: "refresh",
        tone: "forecast",
      });
    }
  },
});

/** Reports mode: read the whole history on the first sync (or a full refresh), otherwise the last three months. */
export const startBalances = internalMutation({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .first();
    const now = currentPeriod();
    const full = Boolean(run.full || !connection?.balancesThrough || !connection.historyFrom);
    const cursor = full ? periodAdd(now, -(HISTORY_MONTHS + 1)) : periodAdd(now, -2);
    await ctx.db.patch(runId, { full, cursor, phase: "balances", monthsStored: 0, attempts: 0, error: undefined });
    if (connection && full) await ctx.db.patch(connection._id, { historyFrom: cursor });
  },
});

export const balancesInput = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const retained =
      accounts.find((a) => a.systemAccount === "RETAINEDEARNINGS") ?? accounts.find((a) => a.accountClass === "EQUITY" && /retained/i.test(a.name));
    return { retainedEarningsId: retained?.xeroAccountId ?? null, historyFrom: connection?.historyFrom ?? null };
  },
});

/** Replace whole months of balances. Rereading a month replaces it, so late postings land exactly once. */
export const storeBalances = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    orgId: v.id("organizations"),
    periods: v.array(v.object({ period: v.string(), lines: v.array(v.object({ xero_account_id: v.string(), net_cents: v.number() })) })),
    accounts: v.array(
      v.object({ xeroAccountId: v.string(), code: v.string(), name: v.string(), type: v.string(), accountClass: v.string(), systemAccount: v.string(), status: v.string() }),
    ),
    dropBefore: v.optional(v.string()),
    next: v.optional(v.string()),
  },
  handler: async (ctx, { runId, orgId, periods, accounts, dropBefore, next }) => {
    await upsertAccounts(ctx, orgId, accounts);
    if (dropBefore) {
      const older = await ctx.db
        .query("accountBalances")
        .withIndex("by_org_period", (q) => q.eq("orgId", orgId).lt("period", dropBefore))
        .collect();
      for (const row of older) await ctx.db.delete(row._id);
    }
    for (const { period, lines } of periods) {
      const existing = await ctx.db
        .query("accountBalances")
        .withIndex("by_org_period", (q) => q.eq("orgId", orgId).eq("period", period))
        .collect();
      for (const row of existing) await ctx.db.delete(row._id);
      for (const line of lines) {
        if (!Number.isSafeInteger(line.net_cents)) throw new Error(`Bad amount for ${line.xero_account_id} in ${period}`);
        await ctx.db.insert("accountBalances", { orgId, xeroAccountId: line.xero_account_id, period, netCents: BigInt(line.net_cents) });
      }
    }
    const run = await ctx.db.get(runId);
    if (run) {
      await ctx.db.patch(runId, {
        monthsStored: (run.monthsStored ?? 0) + periods.length,
        pagesDone: run.pagesDone + 1,
        attempts: 0,
        error: undefined,
        touchedAt: Date.now(),
        ...(next ? { cursor: next } : { phase: "cash" as const, cursor: undefined }),
      });
    }
    const latest = periods.reduce((max, p) => (p.period > max ? p.period : max), "");
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (connection && latest && (!connection.balancesThrough || latest > connection.balancesThrough)) {
      await ctx.db.patch(connection._id, { balancesThrough: latest });
    }
  },
});

/** Replace the daily cash calendar for a window, from payments and bank transactions. */
export const storeDailyCash = internalMutation({
  args: { orgId: v.id("organizations"), from: v.string(), to: v.string(), days: v.array(v.object({ date: v.string(), net_cents: v.number() })) },
  handler: async (ctx, { orgId, from, to, days }) => {
    const existing = await ctx.db
      .query("dailyCash")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId).gte("date", from).lte("date", to))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const day of days) {
      if (day.date >= from && day.date <= to) await ctx.db.insert("dailyCash", { orgId, date: day.date, netCents: BigInt(day.net_cents) });
    }
  },
});

export const accountFields = v.object({
  xeroAccountId: v.string(),
  code: v.string(),
  name: v.string(),
  type: v.string(),
  accountClass: v.string(),
  systemAccount: v.string(),
  status: v.string(),
});

export async function upsertAccounts(ctx: MutationCtx, orgId: Id<"organizations">, accounts: (typeof accountFields.type)[]) {
  for (const account of accounts) {
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_org_xero", (q) => q.eq("orgId", orgId).eq("xeroAccountId", account.xeroAccountId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, account);
    else await ctx.db.insert("accounts", { orgId, ...account });
  }
}

export const storeAccounts = internalMutation({
  args: { orgId: v.id("organizations"), accounts: v.array(accountFields) },
  handler: (ctx, { orgId, accounts }) => upsertAccounts(ctx, orgId, accounts),
});

/**
 * Store journals with their lines, and keep monthly balances and daily cash in step, in one transaction.
 * Journals already stored are skipped, so storing the same page twice changes nothing. With `knownAccounts`,
 * a line on any other account is refused (imports check this; Xero's own references are trusted).
 */
export async function storeJournals(ctx: MutationCtx, orgId: Id<"organizations">, journals: EngineJournal[], knownAccounts?: Set<string>) {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const bankAccounts = new Set(accounts.filter((a) => a.type === "BANK").map((a) => a.xeroAccountId));
  const balanceDeltas = new Map<string, bigint>();
  const cashDeltas = new Map<string, bigint>();
  let stored = 0;
  let last: EngineJournal | null = null;
  for (const journal of journals) {
    last = journal;
    const exists = await ctx.db
      .query("journals")
      .withIndex("by_org_xero", (q) => q.eq("orgId", orgId).eq("xeroJournalId", journal.xero_journal_id))
      .unique();
    if (exists) continue;
    const total = journal.lines.reduce((sum, line) => sum + line.net_cents, 0);
    if (total !== 0 || journal.lines.some((line) => !Number.isSafeInteger(line.net_cents))) throw new Error(`Journal ${journal.journal_number} does not balance`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(journal.date)) throw new Error(`Journal ${journal.journal_number} has no valid date`);
    if (knownAccounts) {
      const unknown = journal.lines.find((line) => !knownAccounts.has(line.xero_account_id));
      if (unknown) throw new Error(`Journal ${journal.journal_number} uses an account that isn't in the chart: ${unknown.xero_account_id}`);
    }
    const journalId = await ctx.db.insert("journals", {
      orgId,
      xeroJournalId: journal.xero_journal_id,
      journalNumber: journal.journal_number,
      date: journal.date,
      sourceType: journal.source_type,
      reference: journal.reference,
    });
    const period = periodOf(journal.date);
    for (const line of journal.lines) {
      const cents = BigInt(line.net_cents);
      await ctx.db.insert("ledgerLines", {
        orgId,
        journalId,
        journalNumber: journal.journal_number,
        xeroAccountId: line.xero_account_id,
        period,
        date: journal.date,
        netCents: cents,
        description: line.description,
        ...(line.contact ? { contact: line.contact } : {}),
        sourceType: journal.source_type,
        reference: journal.reference,
      });
      const key = `${line.xero_account_id}|${period}`;
      balanceDeltas.set(key, (balanceDeltas.get(key) ?? 0n) + cents);
      if (bankAccounts.has(line.xero_account_id)) cashDeltas.set(journal.date, (cashDeltas.get(journal.date) ?? 0n) + cents);
    }
    stored++;
  }
  for (const [key, delta] of balanceDeltas) {
    const [xeroAccountId, period] = key.split("|");
    const row = await ctx.db
      .query("accountBalances")
      .withIndex("by_org_account_period", (q) => q.eq("orgId", orgId).eq("xeroAccountId", xeroAccountId).eq("period", period))
      .unique();
    if (row) await ctx.db.patch(row._id, { netCents: row.netCents + delta });
    else await ctx.db.insert("accountBalances", { orgId, xeroAccountId, period, netCents: delta });
  }
  for (const [date, delta] of cashDeltas) {
    const row = await ctx.db
      .query("dailyCash")
      .withIndex("by_org_date", (q) => q.eq("orgId", orgId).eq("date", date))
      .unique();
    if (row) await ctx.db.patch(row._id, { netCents: row.netCents + delta });
    else await ctx.db.insert("dailyCash", { orgId, date, netCents: delta });
  }
  return { stored, last };
}

/** Store one page of journals from Xero and move the cursor in the same transaction. */
export const storePage = internalMutation({
  args: { runId: v.id("syncRuns"), orgId: v.id("organizations"), journals: v.array(v.any()) },
  handler: async (ctx, { runId, orgId, journals }) => {
    const { stored, last } = await storeJournals(ctx, orgId, journals as EngineJournal[]);
    const run = await ctx.db.get(runId);
    if (run) await ctx.db.patch(runId, { pagesDone: run.pagesDone + 1, journalsStored: run.journalsStored + stored, attempts: 0, error: undefined, touchedAt: Date.now() });
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (connection && last) {
      await ctx.db.patch(connection._id, {
        lastJournalNumber: Math.max(connection.lastJournalNumber, last.journal_number),
        lastJournalId: last.journal_number >= connection.lastJournalNumber ? last.xero_journal_id : connection.lastJournalId,
        journalsStored: connection.journalsStored + stored,
      });
    }
  },
});

const RESET_TABLES = ["ledgerLines", "journals", "accountBalances", "dailyCash", "reportSnapshots", "forecastRuns", "forecastSummaries", "activityCache", "plans", "aiCache"] as const;
// What people wrote: kept when the same company's figures are rebuilt (a re-import, a change of Xero access,
// a Demo Company reset), deleted only when a different Xero organisation replaces the books.
const AUTHORED_TABLES = ["commentaries", "boardNotes"] as const;

/**
 * Delete one batch of an organisation's synced or imported figures (and, optionally, its chart and the
 * commentary and notes written about them). True while more remains.
 */
export async function deleteBatch(ctx: MutationCtx, orgId: Id<"organizations">, withAccounts: boolean, withAuthored = false): Promise<boolean> {
  const tables = [...RESET_TABLES, ...(withAuthored ? AUTHORED_TABLES : []), ...(withAccounts ? (["accounts"] as const) : [])];
  for (const table of tables) {
    const rows =
      table === "forecastRuns"
        ? await ctx.db.query("forecastRuns").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(300)
        : table === "reportSnapshots"
          ? await ctx.db.query("reportSnapshots").withIndex("by_org_kind", (q) => q.eq("orgId", orgId)).take(300)
          : table === "dailyCash"
            ? await ctx.db.query("dailyCash").withIndex("by_org_date", (q) => q.eq("orgId", orgId)).take(300)
            : table === "journals"
              ? await ctx.db.query("journals").withIndex("by_org_number", (q) => q.eq("orgId", orgId)).take(300)
              : table === "commentaries"
                ? await ctx.db.query("commentaries").withIndex("by_org_period", (q) => q.eq("orgId", orgId)).take(300)
                : table === "activityCache"
                  ? await ctx.db.query("activityCache").withIndex("by_org_account_period", (q) => q.eq("orgId", orgId)).take(300)
                  : table === "plans"
                    ? await ctx.db.query("plans").withIndex("by_org_madeAt", (q) => q.eq("orgId", orgId)).take(300)
                    : table === "boardNotes"
                      ? await ctx.db.query("boardNotes").withIndex("by_org_period", (q) => q.eq("orgId", orgId)).take(300)
                      : table === "aiCache"
                        ? await ctx.db.query("aiCache").withIndex("by_org_key", (q) => q.eq("orgId", orgId)).take(300)
                      : await ctx.db.query(table).withIndex("by_org", (q) => q.eq("orgId", orgId)).take(300);
    if (rows.length) {
      for (const row of rows) await ctx.db.delete(row._id);
      return true;
    }
  }
  const connection = await ctx.db
    .query("xeroConnections")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  if (connection) await ctx.db.patch(connection._id, { lastJournalNumber: 0, lastJournalId: undefined, journalsStored: 0 });
  return false;
}

export const clearBatch = internalMutation({
  args: { orgId: v.id("organizations"), accounts: v.boolean(), authored: v.optional(v.boolean()) },
  handler: (ctx, { orgId, accounts, authored }) => deleteBatch(ctx, orgId, accounts, authored),
});

/** Mark the organisation's figures as Xero's. True when they came from a file and must be cleared first. */
export const claimForXero = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return false;
    const imported = org.source === "csv" || org.source === "sample";
    if (org.source !== "xero") await ctx.db.patch(orgId, { source: "xero", sourceLabel: undefined, importedAt: undefined, ...(imported ? { asOf: undefined } : {}) });
    return imported;
  },
});

/** The Demo Company was reset under us: delete one batch of synced data. Returns true while more remains. */
export const resetBatch = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    if (await deleteBatch(ctx, orgId, false)) return true;
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    await audit(ctx, orgId, {
      actor: "Ledgerline",
      action: "detected a reset of",
      target: connection?.tenantName ?? "Xero",
      detail: "The organisation's journals were replaced; resyncing from the start.",
      icon: "refresh",
      tone: "forecast",
    });
    return false;
  },
});

type Finished = "done" | "needsReview" | "failed" | "reauth";

export const finish = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    status: v.union(v.literal("done"), v.literal("needsReview"), v.literal("failed"), v.literal("reauth")),
    error: v.optional(v.string()),
  },
  handler: (ctx, { runId, status, error }) => finishRun(ctx, runId, status, error),
});

async function finishRun(ctx: MutationCtx, runId: Id<"syncRuns">, status: Finished, error?: string) {
  const run = await ctx.db.get(runId);
  if (!run) return;
  const now = Date.now();
  await ctx.db.patch(runId, { status, phase: status === "done" || status === "needsReview" ? "done" : run.phase, finishedAt: now, error });
  const connection = await ctx.db
    .query("xeroConnections")
    .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
    .first();
  const imported = run.source === "csv" || run.source === "sample";
  if (imported) {
    const org = await ctx.db.get(run.orgId);
    if (status === "done") {
      await audit(ctx, run.orgId, {
        actor: "Ledgerline",
        action: "imported",
        target: `${run.journalsStored.toLocaleString("en-IE")} journals`,
        detail: `${run.trigger}${org?.sourceLabel ? ` · ${org.sourceLabel}` : ""}`,
        icon: "upload",
        tone: "positive",
      });
    } else {
      await audit(ctx, run.orgId, { actor: "Ledgerline", action: "could not finish importing", target: org?.sourceLabel ?? "the file", detail: error, icon: "warning", tone: "negative" });
    }
    return;
  }
  if (status === "done" || status === "needsReview") {
    if (connection) await ctx.db.patch(connection._id, { lastSyncAt: now });
    await audit(ctx, run.orgId, {
      actor: "Ledgerline",
      action: "synced",
      target: `${run.journalsStored.toLocaleString("en-IE")} journals`,
      detail: `${run.trigger} · ${status === "done" ? "matches Xero" : "differs from Xero, review needed"}`,
      icon: "sync",
      tone: status === "done" ? "positive" : "negative",
    });
  } else if (status === "failed") {
    await audit(ctx, run.orgId, { actor: "Ledgerline", action: "could not sync", target: connection?.tenantName, detail: error, icon: "warning", tone: "negative" });
  }
  if (connection?.rerunRequested) {
    await ctx.db.patch(connection._id, { rerunRequested: false });
    if (status === "done" || status === "needsReview") await ctx.scheduler.runAfter(1000, internal.sync.enqueue, { orgId: run.orgId, trigger: "Webhook: Xero change" });
  }
}

const QUIET_MS = { xero: 15 * 60 * 1000, import: 60 * 60 * 1000 };

/**
 * The watchdog. A step that dies without finishing (a timeout, a crash, a deploy mid-step) leaves its run live
 * with nothing scheduled, and a live run blocks every later sync and import. Fail any run that has gone quiet,
 * so the next one can start; journals mode resumes from its cursor, so nothing stored is lost.
 */
export const recoverStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const status of ["queued", "running", "backingOff"] as const) {
      const runs = await ctx.db
        .query("syncRuns")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(200);
      for (const run of runs) {
        const imported = run.source === "csv" || run.source === "sample";
        const lastSign = Math.max(run.touchedAt ?? run.startedAt, run.retryAt ?? 0);
        if (now - lastSign < (imported ? QUIET_MS.import : QUIET_MS.xero)) continue;
        await finishRun(
          ctx,
          run._id,
          "failed",
          imported ? "The import stopped before it finished. Start it again." : "The sync stopped responding. The next sync carries on from what was stored.",
        );
      }
    }
  },
});

// ---------- reads ----------

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const found = await currentOrg(ctx);
    if (!found) return [];
    const runs = await ctx.db
      .query("syncRuns")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .order("desc")
      .take(Math.min(limit ?? 20, 100));
    return runs.map((r) => ({
      id: r._id,
      trigger: r.trigger,
      source: r.source ?? "xero",
      mode: r.mode ?? null,
      monthsStored: r.monthsStored ?? null,
      status: r.status,
      phase: r.phase,
      pagesDone: r.pagesDone,
      journalsStored: r.journalsStored,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt ?? null,
      error: r.error ?? null,
    }));
  },
});

export const nightly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const connections = await ctx.db
      .query("xeroConnections")
      .withIndex("by_status", (q) => q.eq("status", "connected"))
      .collect();
    for (const [index, connection] of connections.entries()) {
      // Spread organisations a few seconds apart so we never burst Xero.
      await ctx.scheduler.runAfter(index * 5000, internal.sync.enqueue, { orgId: connection.orgId, trigger: "Nightly" });
    }
  },
});

