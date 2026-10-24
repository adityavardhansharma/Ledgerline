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
  v.literal("balances"),
  v.literal("cash"),
  v.literal("invoices"),
  v.literal("reports"),
  v.literal("reconcile"),
  v.literal("done"),
);
// How a Xero connection is read: every journal (apps with journal access) or monthly trial balances plus
// documents (every other app). Decided from the scopes Xero granted, per connection.
export const xeroMode = v.union(v.literal("journals"), v.literal("reports"));

export const dataSource = v.union(v.literal("xero"), v.literal("csv"), v.literal("sample"));

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
    // Where the figures came from: a Xero sync, an imported CSV file or the sample company.
    source: v.optional(dataSource),
    sourceLabel: v.optional(v.string()),
    importedAt: v.optional(v.number()),
    alerts: v.object({ runwayUnder6: v.boolean(), syncFailsTwice: v.boolean(), differsFromXero: v.boolean() }),
    // The person who set the company up: the Free plan allows each person two.
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerk", ["clerkOrgId"])
    .index("by_creator", ["createdBy"]),

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
    scopes: v.optional(v.array(v.string())),
    // Set when a different Xero organisation replaces this one; the next sync clears the old figures first.
    resetPending: v.optional(v.boolean()),
    mode: v.optional(xeroMode),
    // Reports mode: the first period held (the opening position) and the latest period read.
    historyFrom: v.optional(v.string()),
    balancesThrough: v.optional(v.string()),
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
    contact: v.optional(v.string()),
  })
    .index("by_org_account_period", ["orgId", "xeroAccountId", "period"])
    .index("by_org_period", ["orgId", "period"])
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
    .index("by_org_period", ["orgId", "period"])
    .index("by_org_account_period", ["orgId", "xeroAccountId", "period"]),

  // Reports mode: the documents behind one account's month, fetched from Xero on demand.
  activityCache: defineTable({
    orgId: v.id("organizations"),
    xeroAccountId: v.string(),
    period: v.string(),
    version: v.number(),
    data: v.any(),
    createdAt: v.number(),
  }).index("by_org_account_period", ["orgId", "xeroAccountId", "period"]),

  dailyCash: defineTable({ orgId: v.id("organizations"), date: v.string(), netCents: v.int64() }).index("by_org_date", ["orgId", "date"]),

  syncRuns: defineTable({
    orgId: v.id("organizations"),
    trigger: v.string(),
    source: v.optional(dataSource),
    mode: v.optional(xeroMode),
    // Reports mode: the next period to read, whether this run rebuilds the whole history, months stored.
    cursor: v.optional(v.string()),
    full: v.optional(v.boolean()),
    monthsStored: v.optional(v.number()),
    phase: syncPhase,
    status: syncStatus,
    pagesDone: v.number(),
    pagesEstimate: v.optional(v.number()),
    journalsStored: v.number(),
    attempts: v.number(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    retryAt: v.optional(v.number()),
    // The last sign of life: a step starting or storing a page. The watchdog fails runs that go quiet.
    touchedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_org", ["orgId", "startedAt"])
    .index("by_status", ["status"]),

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
    // Before sections: a flat list of paragraphs. Kept so older drafts still show.
    paragraphs: v.optional(v.any()),
    // headline, performance, cash, outlook, risks, decisions, questions; prose is text and cited facts.
    sections: v.optional(v.any()),
    // The facts pack the draft was written from, so every citation can be traced and edits checked.
    facts: v.optional(v.any()),
    tone: v.optional(v.string()),
    length: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("accepted")),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
    editedBy: v.optional(v.string()),
    acceptedBy: v.optional(v.string()),
  }).index("by_org_period", ["orgId", "period"]),

  // The global chat: private threads per person and organisation. Assistant messages hold prose with ```ui blocks.
  chatThreads: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_org_user", ["orgId", "userId", "updatedAt"]),
  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
    tools: v.optional(v.array(v.string())),
    page: v.optional(v.string()),
    // An answer that wasn't written because the month's chats ran out; kept out of the model's history.
    paused: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),

  // AI actions: answers kept until the figures they explain change, and one row per model call for metering.
  aiCache: defineTable({
    orgId: v.id("organizations"),
    key: v.string(),
    version: v.number(),
    data: v.any(),
    createdAt: v.number(),
  }).index("by_org_key", ["orgId", "key"]),
  aiUsage: defineTable({
    orgId: v.id("organizations"),
    action: v.string(),
    by: v.string(),
    at: v.number(),
  }).index("by_org_at", ["orgId", "at"]),

  // Vouchers raise a company's monthly AI allowances; a company redeems each code once.
  vouchers: defineTable({
    code: v.string(),
    limits: v.object({ actions: v.optional(v.number()), searches: v.optional(v.number()), chats: v.optional(v.number()) }),
    active: v.boolean(),
    maxRedemptions: v.optional(v.number()),
    redemptions: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),
  voucherRedemptions: defineTable({
    orgId: v.id("organizations"),
    voucherId: v.id("vouchers"),
    code: v.string(),
    by: v.string(),
    at: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_voucher", ["orgId", "voucherId"]),

  // Context for a month's commentary that only the team knows ("lost the Murphy contract").
  boardNotes: defineTable({
    orgId: v.id("organizations"),
    period: v.string(),
    text: v.string(),
    updatedBy: v.string(),
    updatedAt: v.number(),
  }).index("by_org_period", ["orgId", "period"]),

  // The base case as first forecast after each month closed, so later months compare actual with plan.
  plans: defineTable({
    orgId: v.id("organizations"),
    madeAt: v.string(),
    months: v.array(v.object({ period: v.string(), revenue: v.number(), ebitda: v.number(), netProfit: v.number(), cash: v.number() })),
    createdAt: v.number(),
  }).index("by_org_madeAt", ["orgId", "madeAt"]),

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
