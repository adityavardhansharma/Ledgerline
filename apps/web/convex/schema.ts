import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Money is int64 cents in every table that stores amounts. Convex numbers are floats and cannot hold money.

export const hire = v.object({ id: v.string(), role: v.string(), salaryCents: v.number(), startPeriod: v.string(), count: v.number() });
export const oneOff = v.object({
  id: v.string(),
  label: v.string(),
  period: v.string(),
  amountCents: v.number(),
  kind: v.union(v.literal("capex"), v.literal("income"), v.literal("expense")),
});
export const financing = v.object({
  id: v.string(),
  period: v.string(),
  kind: v.union(v.literal("loan"), v.literal("equity"), v.literal("dividend")),
  amountCents: v.number(),
});

export const syncPhase = v.union(
  v.literal("queued"),
  v.literal("accounts"),
  v.literal("journals"),
  v.literal("invoices"),
  v.literal("reports"),
  v.literal("reconcile"),
  v.literal("done"),
);
export const syncStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("backingOff"),
  v.literal("done"),
  v.literal("needsReview"),
  v.literal("failed"),
  v.literal("reauth"),
);

export default defineSchema({
  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    currency: v.string(),
    fyStartMonth: v.number(),
    basis: v.union(v.literal("accrual"), v.literal("cash")),
    actualsVersion: v.number(),
    asOf: v.optional(v.string()),
    alerts: v.object({ runwayUnder6: v.boolean(), syncFailsTwice: v.boolean(), differsFromXero: v.boolean() }),
    createdAt: v.number(),
  }).index("by_clerk", ["clerkOrgId"]),

  oauthStates: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    state: v.string(),
    verifier: v.string(),
    redirectUri: v.string(),
    createdAt: v.number(),
  }).index("by_state", ["state"]),

  xeroConnections: defineTable({
    orgId: v.id("organizations"),
    tenantId: v.string(),
    tenantName: v.string(),
    accessTokenEnc: v.bytes(),
    refreshTokenEnc: v.bytes(),
    expiresAt: v.number(),
    lastJournalNumber: v.number(),
    lastJournalId: v.optional(v.string()),
    journalsStored: v.number(),
    status: v.union(v.literal("connected"), v.literal("expired"), v.literal("revoked")),
    connectedAt: v.number(),
    lastSyncAt: v.optional(v.number()),
    rerunRequested: v.optional(v.boolean()),
  })
    .index("by_org", ["orgId"])
    .index("by_tenant", ["tenantId"])
    .index("by_status", ["status"]),

  accounts: defineTable({
    orgId: v.id("organizations"),
    xeroAccountId: v.string(),
    code: v.string(),
    name: v.string(),
    type: v.string(),
    accountClass: v.string(),
    systemAccount: v.string(),
    status: v.string(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_xero", ["orgId", "xeroAccountId"]),

  journals: defineTable({
    orgId: v.id("organizations"),
    xeroJournalId: v.string(),
    journalNumber: v.number(),
    date: v.string(),
    sourceType: v.string(),
    reference: v.string(),
  })
    .index("by_org_xero", ["orgId", "xeroJournalId"])
    .index("by_org_number", ["orgId", "journalNumber"])
    .index("by_org_date", ["orgId", "date"]),

  ledgerLines: defineTable({
    orgId: v.id("organizations"),
    journalId: v.id("journals"),
    journalNumber: v.number(),
    xeroAccountId: v.string(),
    period: v.string(),
    date: v.string(),
    netCents: v.int64(),
    description: v.string(),
    sourceType: v.string(),
    reference: v.string(),
  })
    .index("by_org_account_period", ["orgId", "xeroAccountId", "period"])
    .index("by_journal", ["journalId"])
    .index("by_org", ["orgId"]),

  // Monthly movement per account, maintained as journals arrive, so statements never rescan the ledger.
  accountBalances: defineTable({
    orgId: v.id("organizations"),
    xeroAccountId: v.string(),
    period: v.string(),
    netCents: v.int64(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_account_period", ["orgId", "xeroAccountId", "period"]),

  dailyCash: defineTable({ orgId: v.id("organizations"), date: v.string(), netCents: v.int64() }).index("by_org_date", ["orgId", "date"]),

  syncRuns: defineTable({
    orgId: v.id("organizations"),
    trigger: v.string(),
    phase: syncPhase,
    status: syncStatus,
    pagesDone: v.number(),
    pagesEstimate: v.optional(v.number()),
    journalsStored: v.number(),
    attempts: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    retryAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_org", ["orgId", "startedAt"]),

  reportSnapshots: defineTable({
    orgId: v.id("organizations"),
    kind: v.union(v.literal("statements"), v.literal("ageing"), v.literal("reconciliation")),
    version: v.number(),
    data: v.any(),
    createdAt: v.number(),
  }).index("by_org_kind", ["orgId", "kind", "version"]),

  scenarios: defineTable({
    orgId: v.id("organizations"),
    parentId: v.optional(v.id("scenarios")),
    name: v.string(),
    isBase: v.boolean(),
    overrides: v.record(v.string(), v.number()),
    hires: v.array(hire),
    oneOffs: v.array(oneOff),
    financing: v.array(financing),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  forecastRuns: defineTable({
    orgId: v.id("organizations"),
    scenarioId: v.id("scenarios"),
    inputsHash: v.string(),
    actualsVersion: v.number(),
    data: v.any(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_scenario_hash", ["scenarioId", "inputsHash"])
    .index("by_scenario", ["scenarioId", "createdAt"]),

  commentaries: defineTable({
    orgId: v.id("organizations"),
    period: v.string(),
    paragraphs: v.any(),
    status: v.union(v.literal("draft"), v.literal("accepted")),
    createdAt: v.number(),
    acceptedBy: v.optional(v.string()),
  }).index("by_org_period", ["orgId", "period"]),

  auditEvents: defineTable({
    orgId: v.id("organizations"),
    actor: v.string(),
    action: v.string(),
    target: v.optional(v.string()),
    detail: v.optional(v.string()),
    icon: v.string(),
    tone: v.optional(v.string()),
    at: v.number(),
  }).index("by_org_at", ["orgId", "at"]),
});
