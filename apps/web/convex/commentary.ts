import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { currentOrg, requireOrg } from "./lib/auth";
import { engine } from "./lib/engine";

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money = (cents: number) => (cents < 0 ? `(${eur.format(-cents / 100)})` : eur.format(cents / 100));
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const facts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const found = await requireOrg(ctx, { write: true });
    const snapshot = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_org_kind", (q) => q.eq("orgId", found.org._id).eq("kind", "statements"))
      .order("desc")
      .first();
    if (!snapshot) return null;
    const m = snapshot.data.measures;
    const month = `${MONTHS[Number(m.month.slice(5, 7)) - 1]} ${m.month.slice(0, 4)}`;
    const list = [
      { id: "revenue", label: "Revenue", value: money(m.revenue), source: `Sales accounts, ${month}` },
      { id: "grossMargin", label: "Gross margin", value: m.grossMargin == null ? "n/a" : pct(m.grossMargin), source: "Gross profit ÷ revenue" },
      // With no depreciation, interest or tax the two are the same figure; one fact keeps the prose from saying it twice.
      ...(m.ebitda === m.netProfit
        ? [{ id: "netProfit", label: "EBITDA and net profit (equal: no depreciation, interest or tax)", value: money(m.netProfit), source: `Profit and loss, ${month}` }]
        : [
            { id: "ebitda", label: "EBITDA", value: money(m.ebitda), source: `Profit and loss, ${month}` },
            { id: "netProfit", label: "Net profit", value: money(m.netProfit), source: `Profit and loss, ${month}` },
          ]),
      { id: "cash", label: "Cash at bank", value: money(m.cash), source: `Bank accounts at month end` },
      { id: "debtors", label: "Trade debtors", value: money(m.debtors), source: "Balance sheet" },
    ];
    // A change is a size and a direction: "fall of 4.5%", never "-4.5%", so the prose can't say "down by -4.5%".
    const change = (x: number) => (x < 0 ? "fall" : "rise");
    if (m.revenueDelta != null) list.push({ id: "revenueDelta", label: `Revenue ${change(m.revenueDelta)} on previous month`, value: pct(Math.abs(m.revenueDelta)), source: "Revenue, month on month" });
    if (m.cashDelta != null) list.push({ id: "cashDelta", label: `Cash ${change(m.cashDelta)} on previous month`, value: pct(Math.abs(m.cashDelta)), source: "Bank, month on month" });
    if (m.debtorDays != null) list.push({ id: "debtorDays", label: "Debtor days", value: `${m.debtorDays} days`, source: "Debtors ÷ last three months' revenue" });
    if (m.runwayMonths != null) list.push({ id: "runway", label: "Cash runway", value: `${m.runwayMonths} months`, source: "Cash ÷ average monthly outflow" });
    return { orgId: found.org._id, period: m.month as string, facts: list };
  },
});

export const draft = action({
  args: {},
  handler: async (ctx) => {
    const input = await ctx.runQuery(internal.commentary.facts, {});
    if (!input) throw new ConvexError("Add your figures before drafting commentary: sync Xero, import a CSV or load the sample company.");
    const result = await engine<{ paragraphs: unknown }>("/commentary/draft", { facts: input.facts });
    await ctx.runMutation(internal.commentary.save, { orgId: input.orgId, period: input.period, paragraphs: result.paragraphs });
  },
});

export const save = internalMutation({
  args: { orgId: v.id("organizations"), period: v.string(), paragraphs: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("commentaries", { ...args, status: "draft", createdAt: Date.now() });
  },
});

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
    return row ? { id: row._id, period: row.period, paragraphs: row.paragraphs, status: row.status, acceptedBy: row.acceptedBy ?? null, createdAt: row.createdAt } : null;
  },
});
