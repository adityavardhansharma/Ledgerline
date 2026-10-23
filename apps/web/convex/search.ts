import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalQuery, query } from "./_generated/server";
import { currentOrg, requireOrg } from "./lib/auth";
import { EngineError, engine } from "./lib/engine";
import { toNumber } from "./lib/money";
import { limitError, remaining } from "./lib/plan";

/**
 * Ledger search in plain words. The model only turns the words into filters (accounts from the chart, a contact
 * that exists, dates, amounts the person typed); the search itself is an ordinary query over journal lines, and
 * the filters show as chips the person can remove.
 */

export const filters = v.object({
  accounts: v.array(v.string()),
  contact: v.string(),
  words: v.string(),
  dateFrom: v.string(),
  dateTo: v.string(),
  minCents: v.union(v.number(), v.null()),
  maxCents: v.union(v.number(), v.null()),
  side: v.union(v.literal("any"), v.literal("debit"), v.literal("credit")),
});
export type Filters = typeof filters.type;

export const vocabulary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org, who } = await requireOrg(ctx);
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const contacts = new Map<string, number>();
    const recent = await ctx.db
      .query("ledgerLines")
      .withIndex("by_org_period", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(6000);
    for (const line of recent) if (line.contact) contacts.set(line.contact, (contacts.get(line.contact) ?? 0) + 1);
    const first = await ctx.db
      .query("journals")
      .withIndex("by_org_number", (q) => q.eq("orgId", org._id))
      .first();
    return {
      orgId: org._id,
      who: who.name,
      accounts: accounts.map((a) => ({ code: a.code, name: a.name })),
      contacts: [...contacts].sort((a, b) => b[1] - a[1]).slice(0, 400).map(([name]) => name),
      firstDate: first?.date ?? null,
      ...(await remaining(ctx, org._id, "searches").then(({ left, resetsAt }) => ({ searchesLeft: left, resetsAt }))),
    };
  },
});

export const parse = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<Filters> => {
    const words = text.trim();
    if (!words) throw new ConvexError("Type what you're looking for.");
    if (words.length > 300) throw new ConvexError("Keep searches under 300 characters.");
    const vocab = await ctx.runQuery(internal.search.vocabulary, {});
    if (vocab.searchesLeft <= 0) throw limitError("searches", vocab.resetsAt);
    try {
      const result = await engine<Filters>("/search/parse", {
        text: words,
        today: new Date().toISOString().slice(0, 10),
        accounts: vocab.accounts,
        contacts: vocab.contacts,
        first_date: vocab.firstDate,
      });
      await ctx.runMutation(internal.aiActions.cacheSet, { orgId: vocab.orgId, key: "", version: 0, data: null, action: "search", by: vocab.who });
      return result;
    } catch (err) {
      if (err instanceof EngineError) throw new ConvexError(err.status === 422 ? "Couldn't read that search. Try naming an account, a customer or a date." : "Search didn't answer. Try again in a moment.");
      throw err;
    }
  },
});

const LIMIT = 300;

/** Journal lines matching the filters, newest first. */
export const results = query({
  args: { filters },
  handler: async (ctx, { filters: f }) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    const orgId = found.org._id;
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const byId = new Map(accounts.map((a) => [a.xeroAccountId, a]));
    const fromPeriod = f.dateFrom ? f.dateFrom.slice(0, 7) : "0000-00";
    const toPeriod = f.dateTo ? f.dateTo.slice(0, 7) : "9999-99";
    let candidates: Doc<"ledgerLines">[] = [];
    let capped = false;
    if (f.accounts.length) {
      const ids = accounts.filter((a) => f.accounts.includes(a.code)).map((a) => a.xeroAccountId);
      for (const id of ids) {
        const rows = await ctx.db
          .query("ledgerLines")
          .withIndex("by_org_account_period", (q) => q.eq("orgId", orgId).eq("xeroAccountId", id).gte("period", fromPeriod).lte("period", toPeriod))
          .take(5000);
        capped ||= rows.length === 5000;
        candidates.push(...rows);
      }
    } else {
      candidates = await ctx.db
        .query("ledgerLines")
        .withIndex("by_org_period", (q) => q.eq("orgId", orgId).gte("period", fromPeriod).lte("period", toPeriod))
        .order("desc")
        .take(8000);
      capped = candidates.length === 8000;
    }
    const words = f.words.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = candidates.filter((l) => {
      if (f.dateFrom && l.date < f.dateFrom) return false;
      if (f.dateTo && l.date > f.dateTo) return false;
      if (f.contact && l.contact !== f.contact) return false;
      const cents = toNumber(l.netCents);
      if (f.side === "debit" && cents <= 0) return false;
      if (f.side === "credit" && cents >= 0) return false;
      if (f.minCents !== null && Math.abs(cents) < f.minCents) return false;
      if (f.maxCents !== null && Math.abs(cents) > f.maxCents) return false;
      if (words.length) {
        const hay = `${l.description} ${l.reference} ${l.contact ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    matches.sort((a, b) => (a.date === b.date ? b.journalNumber - a.journalNumber : b.date.localeCompare(a.date)));
    const rows = matches.slice(0, LIMIT).map((l) => {
      const cents = toNumber(l.netCents);
      const account = byId.get(l.xeroAccountId);
      return {
        id: l._id,
        date: l.date,
        journalNumber: l.journalNumber,
        code: account?.code ?? "",
        account: account?.name ?? "Unknown account",
        contact: l.contact ?? "",
        description: l.description || [l.sourceType, l.reference].filter(Boolean).join(" · "),
        debitCents: cents > 0 ? cents : 0,
        creditCents: cents < 0 ? -cents : 0,
      };
    });
    return {
      rows,
      count: matches.length,
      more: matches.length > LIMIT,
      capped,
      debitCents: matches.reduce((s, l) => s + Math.max(0, toNumber(l.netCents)), 0),
      creditCents: matches.reduce((s, l) => s + Math.max(0, -toNumber(l.netCents)), 0),
    };
  },
});
