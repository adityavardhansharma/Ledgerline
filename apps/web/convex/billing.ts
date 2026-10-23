import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { caller, currentOrg, requireOrg } from "./lib/auth";
import { FREE, limitsFor, remaining, usage } from "./lib/plan";

/** The company's plan and what it has used this month, for Settings → Billing. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    const { org, who } = found;
    const { used, resetsAt } = await usage(ctx, org._id);
    const { limits, vouchers } = await limitsFor(ctx, org._id);
    const owner = org.createdBy ?? (who.role === "owner" ? who.userId : null);
    const companies = owner
      ? await ctx.db
          .query("organizations")
          .withIndex("by_creator", (q) => q.eq("createdBy", owner))
          .take(FREE.companies + 1)
      : [];
    return {
      plan: FREE.name,
      resetsAt,
      meters: (["actions", "searches", "chats"] as const).map((meter) => ({ meter, used: used[meter], limit: limits[meter] })),
      vouchers: vouchers.map((voucher) => voucher.code),
      canRedeem: who.role !== "accountant",
      companies: {
        // A company counts towards the person who set it up; this one always counts.
        used: Math.max(companies.length, 1),
        limit: FREE.companies,
        names: companies.map((c) => c.name),
        mine: owner === who.userId,
      },
    };
  },
});

/** When the active Clerk organisation has no company yet: whether the plan lets this person set it up. */
export const newCompany = query({
  args: {},
  handler: async (ctx) => {
    const who = await caller(ctx);
    if (!who) return null;
    const mine = await ctx.db
      .query("organizations")
      .withIndex("by_creator", (q) => q.eq("createdBy", who.userId))
      .take(FREE.companies);
    return { blocked: mine.length >= FREE.companies, limit: FREE.companies, names: mine.map((c) => c.name) };
  },
});

/** What's left of one allowance for the caller's company, for actions that check before calling the model. */
export const left = internalQuery({
  args: { meter: v.union(v.literal("actions"), v.literal("searches"), v.literal("chats")) },
  handler: async (ctx, { meter }) => {
    const { org } = await requireOrg(ctx);
    return remaining(ctx, org._id, meter);
  },
});

const normalise = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

/** Redeem a voucher for the caller's company: its allowances apply from now, for as long as it stays active. */
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { org, who } = await requireOrg(ctx, { write: true });
    const clean = normalise(code);
    if (!clean) throw new ConvexError("Enter a voucher code.");
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", clean))
      .unique();
    if (!voucher || !voucher.active) throw new ConvexError("That voucher code isn't valid.");
    const already = await ctx.db
      .query("voucherRedemptions")
      .withIndex("by_org_voucher", (q) => q.eq("orgId", org._id).eq("voucherId", voucher._id))
      .first();
    if (already) throw new ConvexError(`${clean} is already applied to ${org.name}.`);
    if (voucher.maxRedemptions !== undefined && voucher.redemptions >= voucher.maxRedemptions) throw new ConvexError("That voucher has been used up.");
    await ctx.db.insert("voucherRedemptions", { orgId: org._id, voucherId: voucher._id, code: clean, by: who.name, at: Date.now() });
    await ctx.db.patch(voucher._id, { redemptions: voucher.redemptions + 1 });
    await audit(ctx, org._id, { actor: who.name, action: "redeemed voucher", target: clean, icon: "sparkle", tone: "brand" });
    return { code: clean, limits: voucher.limits };
  },
});

/** Create or update a voucher (run from the dashboard or `npx convex run billing:setVoucher`). */
export const setVoucher = internalMutation({
  args: {
    code: v.string(),
    limits: v.object({ actions: v.optional(v.number()), searches: v.optional(v.number()), chats: v.optional(v.number()) }),
    active: v.optional(v.boolean()),
    maxRedemptions: v.optional(v.number()),
  },
  handler: async (ctx, { code, limits, active, maxRedemptions }) => {
    const clean = normalise(code);
    const existing = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", clean))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { limits, active: active ?? existing.active, maxRedemptions });
      return existing._id;
    }
    return ctx.db.insert("vouchers", { code: clean, limits, active: active ?? true, maxRedemptions, redemptions: 0, createdAt: Date.now() });
  },
});
