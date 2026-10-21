import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { currentOrg } from "./lib/auth";
import { toNumber } from "./lib/money";

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
