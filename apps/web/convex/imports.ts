/**
 * Importing figures from CSV files (or the bundled sample company) instead of syncing Xero.
 *
 * The browser parses and checks the files, then: `start` clears the organisation's figures and stores the
 * chart of accounts; `page` stores journals in batches through the same code as a Xero sync; `complete`
 * builds the statements. An import is recorded as a sync run, so progress, history and the audit log work
 * the same way for both.
 */
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireOrg } from "./lib/auth";
import { type EngineJournal, accountFields, storeJournals, upsertAccounts } from "./sync";

const source = v.union(v.literal("csv"), v.literal("sample"));
const LIVE = ["queued", "running", "backingOff"];

/**
 * Claim the organisation for an import: refuses while Xero is connected or a sync or import is running, and
 * opens the run in the same transaction, so two imports started at once can't both clear and fill the books.
 * The run waits in "accounts" until the old figures are cleared and the new chart is stored.
 */
export const claim = internalMutation({
  args: { source },
  handler: async (ctx, { source }) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (connection?.status === "connected") {
      throw new ConvexError("Xero is connected. Disconnect it in Sync and Xero first, so the nightly sync doesn't replace your file.");
    }
    const last = await ctx.db
      .query("syncRuns")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .first();
    if (last && LIVE.includes(last.status)) throw new ConvexError("A sync or import is already running. Wait for it to finish.");
    const now = Date.now();
    const runId = await ctx.db.insert("syncRuns", {
      orgId: org._id,
      trigger: source === "sample" ? "Sample company" : "CSV import",
      source,
      phase: "accounts",
      status: "running",
      pagesDone: 0,
      journalsStored: 0,
      attempts: 0,
      startedAt: now,
      touchedAt: now,
    });
    return { orgId: org._id, actor: who.name, runId };
  },
});

export const open = internalMutation({
  args: { runId: v.id("syncRuns"), orgId: v.id("organizations"), actor: v.string(), source, label: v.string(), accounts: v.array(accountFields) },
  handler: async (ctx, { runId, orgId, actor, source, label, accounts }) => {
    await upsertAccounts(ctx, orgId, accounts);
    await ctx.db.patch(orgId, { source, sourceLabel: label, importedAt: Date.now(), asOf: undefined });
    await ctx.db.patch(runId, { phase: "journals", touchedAt: Date.now() });
    await audit(ctx, orgId, { actor, action: "started importing", target: label, detail: `${accounts.length} accounts`, icon: "upload" });
  },
});

/** Clear the organisation's figures and chart, store the new chart and open an import run. */
export const start = action({
  args: { source, label: v.string(), accounts: v.array(accountFields) },
  handler: async (ctx, { source, label, accounts }): Promise<Id<"syncRuns">> => {
    if (!accounts.length) throw new ConvexError("The chart of accounts is empty.");
    if (accounts.length > 2000) throw new ConvexError("Ledgerline imports up to 2,000 accounts.");
    if (accounts.some((a) => !a.xeroAccountId.startsWith("csv:"))) throw new ConvexError("Imported accounts must come from a file.");
    const { orgId, actor, runId } = await ctx.runMutation(internal.imports.claim, { source });
    try {
      let more = true;
      while (more) more = await ctx.runMutation(internal.sync.clearBatch, { orgId, accounts: true });
      await ctx.runMutation(internal.imports.open, { runId, orgId, actor, source, label: label.slice(0, 120), accounts });
    } catch (err) {
      await ctx.runMutation(internal.sync.finish, { runId, status: "failed", error: "The import couldn't clear the old figures. Try again." });
      throw err;
    }
    return runId;
  },
});

/** Store one batch of journals into a running import. */
export const page = mutation({
  args: { runId: v.id("syncRuns"), journals: v.array(v.any()) },
  handler: async (ctx, { runId, journals }) => {
    const { org } = await requireOrg(ctx, { write: true });
    const run = await ctx.db.get(runId);
    if (!run || run.orgId !== org._id || !run.source || run.source === "xero") throw new ConvexError("Import not found.");
    if (run.status !== "running" || run.phase !== "journals") throw new ConvexError("This import has finished.");
    if (journals.length > 2000) throw new ConvexError("Send at most 2,000 journals at a time.");
    for (const j of journals as EngineJournal[]) {
      if (!String(j.xero_journal_id).startsWith("csv:")) throw new ConvexError("Imported journals must come from a file.");
    }
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    try {
      const { stored } = await storeJournals(ctx, org._id, journals as EngineJournal[], new Set(accounts.map((a) => a.xeroAccountId)));
      await ctx.db.patch(runId, { pagesDone: run.pagesDone + 1, journalsStored: run.journalsStored + stored, touchedAt: Date.now() });
    } catch (err) {
      throw new ConvexError(err instanceof Error ? err.message : String(err));
    }
  },
});

export const runFor = internalQuery({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, { runId }) => {
    const { org } = await requireOrg(ctx, { write: true });
    const run = await ctx.db.get(runId);
    if (!run || run.orgId !== org._id || !run.source || run.source === "xero") throw new ConvexError("Import not found.");
    return run;
  },
});

export const toReports = internalMutation({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, { runId }) => {
    await ctx.db.patch(runId, { phase: "reports", status: "running", error: undefined, attempts: 0, touchedAt: Date.now() });
  },
});

/** Build the statements from the imported journals. Also retries an import whose report step failed. */
export const complete = action({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.runQuery(internal.imports.runFor, { runId });
    const retry = run.status === "failed" && run.phase === "reports";
    if (!retry && !(run.status === "running" && run.phase === "journals")) throw new ConvexError("This import has finished.");
    await ctx.runMutation(internal.imports.toReports, { runId });
    try {
      await ctx.runAction(internal.reports.rebuild, { orgId: run.orgId });
      await ctx.runMutation(internal.sync.finish, { runId, status: "done" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const message = /LL_ENGINE_URL|fetch failed|ECONNREFUSED|engine 5\d\d/.test(raw)
        ? "Your journals are stored, but Ledgerline's finance engine couldn't be reached to build the reports. Try again once it's running."
        : raw.replace(/^.*(ConvexError|Uncaught Error): /, "").slice(0, 400);
      await ctx.runMutation(internal.sync.finish, { runId, status: "failed", error: message });
      throw new ConvexError(message);
    }
  },
});

/** Abandon an import that stopped part-way, so a new one can start. */
export const cancel = mutation({
  args: { runId: v.id("syncRuns") },
  handler: async (ctx, { runId }) => {
    const { org } = await requireOrg(ctx, { write: true });
    const run = await ctx.db.get(runId);
    if (!run || run.orgId !== org._id || !run.source || run.source === "xero" || !LIVE.includes(run.status)) return;
    await ctx.db.patch(runId, { status: "failed", finishedAt: Date.now(), error: "The import was stopped before it finished." });
  },
});
