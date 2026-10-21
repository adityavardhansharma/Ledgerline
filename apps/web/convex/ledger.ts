import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { currentOrg, requireOrg } from "./lib/auth";
import { EngineError, engine } from "./lib/engine";
import { toNumber } from "./lib/money";
import { persistRotated } from "./lib/tokens";
import type { Tokens } from "./xero";

/** The journal lines behind one statement figure: one account, one month. */
export const lines = query({
  args: { xeroAccountId: v.string(), period: v.string() },
  handler: async (ctx, { xeroAccountId, period }) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    const account = await ctx.db
      .query("accounts")
      .withIndex("by_org_xero", (q) => q.eq("orgId", found.org._id).eq("xeroAccountId", xeroAccountId))
      .unique();
    const rows = await ctx.db
      .query("ledgerLines")
      .withIndex("by_org_account_period", (q) => q.eq("orgId", found.org._id).eq("xeroAccountId", xeroAccountId).eq("period", period))
      .take(500);
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.journalNumber - b.journalNumber);
    return {
      account: account ? { code: account.code, name: account.name, type: account.type } : null,
      lines: rows.map((r) => {
        const cents = toNumber(r.netCents);
        return {
          id: r._id,
          date: r.date,
          journalNumber: r.journalNumber,
          reference: r.reference,
          sourceType: r.sourceType,
          description: r.description,
          debitCents: cents > 0 ? cents : 0,
          creditCents: cents < 0 ? -cents : 0,
        };
      }),
    };
  },
});

/** Every journal, newest first, with its lines and account names. */
export const journals = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const found = await currentOrg(ctx);
    if (!found) return { page: [], isDone: true, continueCursor: "" };
    const accounts = new Map(
      (
        await ctx.db
          .query("accounts")
          .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
          .collect()
      ).map((a) => [a.xeroAccountId, a]),
    );
    const result = await ctx.db
      .query("journals")
      .withIndex("by_org_number", (q) => q.eq("orgId", found.org._id))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (j) => {
        const lines = await ctx.db
          .query("ledgerLines")
          .withIndex("by_journal", (q) => q.eq("journalId", j._id))
          .collect();
        return {
          id: j._id,
          journalNumber: j.journalNumber,
          date: j.date,
          sourceType: j.sourceType,
          reference: j.reference,
          lines: lines.map((l) => {
            const account = accounts.get(l.xeroAccountId);
            const cents = toNumber(l.netCents);
            return {
              code: account?.code ?? "",
              account: account?.name ?? "Unknown account",
              description: l.description,
              debitCents: cents > 0 ? cents : 0,
              creditCents: cents < 0 ? -cents : 0,
            };
          }),
        };
      }),
    );
    return { ...result, page };
  },
});

/** The chart of accounts, in the same columns the CSV import reads. */
export const chart = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return [];
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", found.org._id))
      .collect();
    return accounts
      .map((a) => ({ code: a.code, name: a.name, type: a.type, systemAccount: a.systemAccount }))
      .sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  },
});

export interface ActivityLine {
  date: string;
  source: string;
  reference: string;
  contact: string;
  description: string;
  net_cents: number;
}

export interface Activity {
  lines: ActivityLine[];
  explained_cents: number;
  unexplained_cents: number;
  movementCents: number;
  fetchedAt: number;
}

const CACHE_MS = 6 * 60 * 60 * 1000;

export const activityInput = internalQuery({
  args: { xeroAccountId: v.string(), period: v.string() },
  handler: async (ctx, { xeroAccountId, period }) => {
    const { org } = await requireOrg(ctx);
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const balance = await ctx.db
      .query("accountBalances")
      .withIndex("by_org_account_period", (q) => q.eq("orgId", org._id).eq("xeroAccountId", xeroAccountId).eq("period", period))
      .unique();
    const cached = await ctx.db
      .query("activityCache")
      .withIndex("by_org_account_period", (q) => q.eq("orgId", org._id).eq("xeroAccountId", xeroAccountId).eq("period", period))
      .order("desc")
      .first();
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    return {
      orgId: org._id,
      version: org.actualsVersion,
      mode: connection?.mode ?? null,
      connected: connection?.status === "connected",
      movementCents: balance ? toNumber(balance.netCents) : 0,
      cached: cached ? { version: cached.version, createdAt: cached.createdAt, data: cached.data as Activity } : null,
      accounts: accounts.map((a) => ({
        xero_account_id: a.xeroAccountId,
        code: a.code,
        name: a.name,
        type: a.type,
        account_class: a.accountClass,
        system_account: a.systemAccount,
      })),
    };
  },
});

export const saveActivity = internalMutation({
  args: { orgId: v.id("organizations"), xeroAccountId: v.string(), period: v.string(), version: v.number(), data: v.any() },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("activityCache")
      .withIndex("by_org_account_period", (q) => q.eq("orgId", args.orgId).eq("xeroAccountId", args.xeroAccountId).eq("period", args.period))
      .collect();
    for (const row of old) await ctx.db.delete(row._id);
    await ctx.db.insert("activityCache", { ...args, createdAt: Date.now() });
  },
});

/**
 * Reports mode: the invoices, bills, payments, bank transactions and manual journals behind one account's
 * month, read from Xero on demand and cached until the figures change. Null in journals mode or for imported
 * figures, where the stored journal lines answer instead.
 */
export const activity = action({
  args: { xeroAccountId: v.string(), period: v.string() },
  handler: async (ctx, { xeroAccountId, period }): Promise<(Activity & { stale?: boolean; error?: string }) | null> => {
    const input = await ctx.runQuery(internal.ledger.activityInput, { xeroAccountId, period });
    if (input.mode !== "reports") return null;
    const cached = input.cached;
    if (cached && cached.version === input.version && Date.now() - cached.createdAt < CACHE_MS) return cached.data;
    if (!input.connected) {
      return cached
        ? { ...cached.data, stale: true }
        : { lines: [], explained_cents: 0, unexplained_cents: input.movementCents, movementCents: input.movementCents, fetchedAt: 0, error: "Reconnect Xero to see the transactions behind this figure." };
    }
    const auth = await ctx.runAction(internal.xero.tokensFor, { orgId: input.orgId });
    if (!auth) return null;
    try {
      const result = await engine<Omit<Activity, "movementCents" | "fetchedAt"> & { tokens?: Tokens }>("/xero/account-activity", {
        tokens: auth.tokens,
        tenant_id: auth.tenantId,
        accounts: input.accounts,
        account_id: xeroAccountId,
        period,
        movement_cents: input.movementCents,
      });
      await persistRotated(ctx, input.orgId, result.tokens);
      const data: Activity = {
        lines: result.lines,
        explained_cents: result.explained_cents,
        unexplained_cents: result.unexplained_cents,
        movementCents: input.movementCents,
        fetchedAt: Date.now(),
      };
      await ctx.runMutation(internal.ledger.saveActivity, { orgId: input.orgId, xeroAccountId, period, version: input.version, data });
      return data;
    } catch (err) {
      const message = err instanceof EngineError && err.status === 429 ? "Xero is busy. Try again in a minute." : "Xero didn't answer. Try again shortly.";
      if (cached) return { ...cached.data, stale: true, error: message };
      return { lines: [], explained_cents: 0, unexplained_cents: input.movementCents, movementCents: input.movementCents, fetchedAt: 0, error: message };
    }
  },
});
