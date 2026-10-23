import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { caller, currentOrg, requireOrg } from "./lib/auth";
import { FREE, remaining, usage } from "./lib/plan";

/** The company's plan and what it has used this month, for Settings → Billing. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    const { org, who } = found;
    const { used, resetsAt } = await usage(ctx, org._id);
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
      meters: (["actions", "searches", "chats"] as const).map((meter) => ({ meter, used: used[meter], limit: FREE[meter] })),
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
