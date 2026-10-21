import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { caller, currentOrg, requireOrg } from "./lib/auth";

/** Create the Ledgerline organisation for the caller's active Clerk organisation, once. */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const who = await caller(ctx);
    if (!who) return null;
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk", (q) => q.eq("clerkOrgId", who.clerkOrgId))
      .unique();
    if (existing) {
      if (who.orgName && existing.name !== who.orgName) await ctx.db.patch(existing._id, { name: who.orgName });
      return existing._id;
    }
    const orgId = await ctx.db.insert("organizations", {
      clerkOrgId: who.clerkOrgId,
      name: who.orgName || "Your organisation",
      currency: "EUR",
      fyStartMonth: 1,
      basis: "accrual",
      actualsVersion: 0,
      alerts: { runwayUnder6: true, syncFailsTwice: true, differsFromXero: false },
      createdAt: Date.now(),
    });
    await audit(ctx, orgId, { actor: who.name, action: "created", target: who.orgName || "Your organisation", icon: "organisation", tone: "brand" });
    return orgId;
  },
});

/** Everything the app shell needs: organisation, role, connection and the latest sync. */
export const current = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return null;
    const { org, who } = found;
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const lastSync = await ctx.db
      .query("syncRuns")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .first();
    return {
      org: {
        id: org._id,
        name: org.name,
        currency: org.currency,
        fyStartMonth: org.fyStartMonth,
        basis: org.basis,
        asOf: org.asOf ?? null,
        actualsVersion: org.actualsVersion,
        source: org.source ?? null,
        sourceLabel: org.sourceLabel ?? null,
        importedAt: org.importedAt ?? null,
        alerts: org.alerts,
      },
      role: who.role,
      user: who.name,
      connection: connection
        ? {
            tenantName: connection.tenantName,
            status: connection.status,
            lastSyncAt: connection.lastSyncAt ?? null,
            journalsStored: connection.journalsStored,
            lastJournalNumber: connection.lastJournalNumber,
            tokenExpiresAt: connection.expiresAt,
            connectedAt: connection.connectedAt,
            mode: connection.mode ?? null,
            historyFrom: connection.historyFrom ?? null,
            balancesThrough: connection.balancesThrough ?? null,
          }
        : null,
      lastSync: lastSync
        ? {
            id: lastSync._id,
            trigger: lastSync.trigger,
            source: lastSync.source ?? "xero",
            mode: lastSync.mode ?? null,
            monthsStored: lastSync.monthsStored ?? null,
            pagesTotal: lastSync.mode === "reports" && lastSync.full ? Math.ceil((HISTORY + 2) / 6) : null,
            status: lastSync.status,
            phase: lastSync.phase,
            pagesDone: lastSync.pagesDone,
            pagesEstimate: lastSync.pagesEstimate ?? null,
            journalsStored: lastSync.journalsStored,
            startedAt: lastSync.startedAt,
            finishedAt: lastSync.finishedAt ?? null,
            error: lastSync.error ?? null,
            retryAt: lastSync.retryAt ?? null,
          }
        : null,
    };
  },
});

const HISTORY = 24;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const updateSettings = mutation({
  args: {
    fyStartMonth: v.optional(v.number()),
    basis: v.optional(v.union(v.literal("accrual"), v.literal("cash"))),
    alerts: v.optional(v.object({ runwayUnder6: v.boolean(), syncFailsTwice: v.boolean(), differsFromXero: v.boolean() })),
  },
  handler: async (ctx, args) => {
    const { org, who } = await requireOrg(ctx, { owner: true });
    if (args.fyStartMonth !== undefined && (args.fyStartMonth < 1 || args.fyStartMonth > 12)) throw new Error("Month must be 1 to 12");
    const patch: Record<string, unknown> = {};
    if (args.fyStartMonth !== undefined) patch.fyStartMonth = args.fyStartMonth;
    if (args.basis) patch.basis = args.basis;
    if (args.alerts) patch.alerts = args.alerts;
    await ctx.db.patch(org._id, patch);
    const detail = args.fyStartMonth ? `Financial year starts in ${MONTHS[args.fyStartMonth - 1]}` : args.basis ? `Basis: ${args.basis}` : "Alerts updated";
    await audit(ctx, org._id, { actor: who.name, action: "changed settings for", target: org.name, detail, icon: "settings" });
  },
});

export const byId = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: (ctx, { orgId }) => ctx.db.get(orgId),
});
