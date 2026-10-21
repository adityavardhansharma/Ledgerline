/**
 * The Xero sync state machine. Each step is one short, retryable action:
 *   accounts → journals (one page per step) → invoices → reports → reconcile → done
 * Journals are append-only in Xero, so the whole sync needs one cursor (the last journal number) and
 * every page is stored idempotently by Xero journal ID.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { currentOrg, requireOrg } from "./lib/auth";
import { EngineError, engine } from "./lib/engine";
import { periodOf } from "./lib/money";
import { persistRotated } from "./lib/tokens";
import type { Tokens } from "./xero";

const MAX_ATTEMPTS = 3;

interface EngineJournal {
  xero_journal_id: string;
  journal_number: number;
  date: string;
  source_type: string;
  reference: string;
  lines: { xero_account_id: string; net_cents: number; description: string }[];
}

// ---------- starting a sync ----------

export const enqueue = internalMutation({
  args: { orgId: v.id("organizations"), trigger: v.string() },
  handler: async (ctx, { orgId, trigger }) => {
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
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .filter((q) => q.eq(q.field("status"), "done"))
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
    const auth = await ctx.runAction(internal.xero.tokensFor, { orgId: run.orgId });
    if (!auth) {
      await ctx.runMutation(internal.sync.finish, { runId, status: "reauth", error: "Xero is not connected." });
      return;
    }
    await ctx.runMutation(internal.sync.patchRun, { runId, patch: { status: "running", retryAt: undefined } });
    const tenant = { tokens: auth.tokens, tenant_id: auth.tenantId };
    try {
      switch (run.phase) {
        case "accounts":
          await stepAccounts(ctx, run, tenant);
          break;
        case "journals":
          await stepJournals(ctx, run, tenant);
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
  await ctx.runMutation(internal.sync.storeAccounts, { orgId: run.orgId, accounts: result.accounts.map(toAccount) });

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
  });
  await persistRotated(ctx, run.orgId, result.tokens);
  const { tokens: _tokens, ...data } = result;
  await ctx.runMutation(internal.reports.storeSnapshot, { orgId: run.orgId, kind: "reconciliation", data: { ...data, checkedAt: Date.now(), asOf: input.asOf } });
  await ctx.runMutation(internal.sync.finish, { runId: run._id, status: result.status === "match" ? "done" : "needsReview" });
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
  args: { runId: v.id("syncRuns"), phase: v.union(v.literal("journals"), v.literal("invoices"), v.literal("reports"), v.literal("reconcile")) },
  handler: async (ctx, { runId, phase }) => {
    await ctx.db.patch(runId, { phase, attempts: 0, error: undefined });
  },
});

export const storeAccounts = internalMutation({
  args: {
    orgId: v.id("organizations"),
    accounts: v.array(
      v.object({ xeroAccountId: v.string(), code: v.string(), name: v.string(), type: v.string(), accountClass: v.string(), systemAccount: v.string(), status: v.string() }),
    ),
  },
  handler: async (ctx, { orgId, accounts }) => {
    for (const account of accounts) {
      const existing = await ctx.db
        .query("accounts")
        .withIndex("by_org_xero", (q) => q.eq("orgId", orgId).eq("xeroAccountId", account.xeroAccountId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, account);
      else await ctx.db.insert("accounts", { orgId, ...account });
    }
  },
});

/** Store one page of journals. Journals already stored are skipped, so a retried page changes nothing. */
export const storePage = internalMutation({
  args: { runId: v.id("syncRuns"), orgId: v.id("organizations"), journals: v.array(v.any()) },
  handler: async (ctx, { runId, orgId, journals }) => {
    const bankAccounts = new Set(
      (
        await ctx.db
          .query("accounts")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      )
        .filter((a) => a.type === "BANK")
        .map((a) => a.xeroAccountId),
    );
    const balanceDeltas = new Map<string, bigint>();
    const cashDeltas = new Map<string, bigint>();
    let stored = 0;
    let last: EngineJournal | null = null;
    for (const journal of journals as EngineJournal[]) {
      last = journal;
      const exists = await ctx.db
        .query("journals")
        .withIndex("by_org_xero", (q) => q.eq("orgId", orgId).eq("xeroJournalId", journal.xero_journal_id))
        .unique();
      if (exists) continue;
      const total = journal.lines.reduce((sum, line) => sum + line.net_cents, 0);
      if (total !== 0) throw new Error(`Journal ${journal.journal_number} does not balance`);
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
    const run = await ctx.db.get(runId);
    if (run) await ctx.db.patch(runId, { pagesDone: run.pagesDone + 1, journalsStored: run.journalsStored + stored, attempts: 0, error: undefined });
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

const RESET_TABLES = ["ledgerLines", "journals", "accountBalances", "dailyCash", "reportSnapshots", "forecastRuns"] as const;

/** Delete one batch of an organisation's synced data. Returns true while more remains. */
export const resetBatch = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    for (const table of RESET_TABLES) {
      const rows =
        table === "forecastRuns"
          ? await ctx.db.query("forecastRuns").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(300)
          : table === "reportSnapshots"
            ? await ctx.db.query("reportSnapshots").withIndex("by_org_kind", (q) => q.eq("orgId", orgId)).take(300)
            : table === "dailyCash"
              ? await ctx.db.query("dailyCash").withIndex("by_org_date", (q) => q.eq("orgId", orgId)).take(300)
              : table === "journals"
                ? await ctx.db.query("journals").withIndex("by_org_number", (q) => q.eq("orgId", orgId)).take(300)
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

export const finish = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    status: v.union(v.literal("done"), v.literal("needsReview"), v.literal("failed"), v.literal("reauth")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { runId, status, error }) => {
    const run = await ctx.db.get(runId);
    if (!run) return;
    const now = Date.now();
    await ctx.db.patch(runId, { status, phase: status === "done" || status === "needsReview" ? "done" : run.phase, finishedAt: now, error });
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .first();
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

