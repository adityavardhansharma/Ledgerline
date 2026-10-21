import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { audit } from "./lib/audit";
import { requireOrg } from "./lib/auth";
import { base64url, decrypt, encrypt, randomString, sha256 } from "./lib/crypto";
import { engine } from "./lib/engine";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const redirectUri = () => `${process.env.CONVEX_SITE_URL}/xero/callback`;

export const createState = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.string(), state: v.string(), verifier: v.string(), redirectUri: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("oauthStates", { ...args, createdAt: Date.now() });
  },
});

export const callerOrg = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { org, who } = await requireOrg(ctx, { owner: true });
    return { orgId: org._id, userId: who.userId };
  },
});

/** Start the OAuth flow: returns Xero's consent URL. The browser goes there next. */
export const beginConnect = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const { orgId, userId } = await ctx.runQuery(internal.xero.callerOrg, {});
    const state = randomString(24);
    const verifier = randomString(48);
    const challenge = base64url(await sha256(verifier));
    await ctx.runMutation(internal.xero.createState, { orgId, userId, state, verifier, redirectUri: redirectUri() });
    const { url } = await engine<{ url: string }>("/xero/authorize-url", { redirect_uri: redirectUri(), state, code_challenge: challenge });
    return url;
  },
});

export const takeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (Date.now() - row.createdAt > 15 * 60 * 1000) return null;
    return row;
  },
});

/** Called by the HTTP callback: swap the code for tokens and store the connection. */
export const finishConnect = internalAction({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, { code, state }): Promise<{ ok: boolean; reason?: string }> => {
    const row = await ctx.runMutation(internal.xero.takeState, { state });
    if (!row) return { ok: false, reason: "expired" };
    const result = await engine<{ tokens: Tokens; connections: { tenant_id: string; tenant_name: string }[] }>("/xero/token", {
      code,
      redirect_uri: row.redirectUri,
      code_verifier: row.verifier,
    });
    const tenant = result.connections[0];
    if (!tenant) return { ok: false, reason: "no-organisation" };
    await ctx.runMutation(internal.xero.saveConnection, {
      orgId: row.orgId,
      tenantId: tenant.tenant_id,
      tenantName: tenant.tenant_name,
      accessTokenEnc: await encrypt(result.tokens.access_token),
      refreshTokenEnc: await encrypt(result.tokens.refresh_token),
      expiresAt: result.tokens.expires_at * 1000,
    });
    return { ok: true };
  },
});

export const saveConnection = internalMutation({
  args: {
    orgId: v.id("organizations"),
    tenantId: v.string(),
    tenantName: v.string(),
    accessTokenEnc: v.bytes(),
    refreshTokenEnc: v.bytes(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (existing && existing.tenantId !== args.tenantId) {
      throw new ConvexError("This Ledgerline organisation is already linked to a different Xero organisation.");
    }
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, status: "connected" });
    } else {
      await ctx.db.insert("xeroConnections", { ...args, lastJournalNumber: 0, journalsStored: 0, status: "connected", connectedAt: Date.now() });
    }
    await audit(ctx, args.orgId, { actor: "Ledgerline", action: "connected Xero organisation", target: args.tenantName, icon: "link", tone: "positive" });
    await ctx.scheduler.runAfter(0, internal.sync.enqueue, { orgId: args.orgId, trigger: existing ? "Reconnected" : "First sync" });
  },
});

/** Decrypted tokens for an action. Never exposed to clients. */
export const tokensFor = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<{ tokens: Tokens; tenantId: string } | null> => {
    const connection = await ctx.runQuery(internal.xero.connectionFor, { orgId });
    if (!connection || connection.status !== "connected") return null;
    return {
      tenantId: connection.tenantId,
      tokens: {
        access_token: await decrypt(connection.accessTokenEnc),
        refresh_token: await decrypt(connection.refreshTokenEnc),
        expires_at: connection.expiresAt / 1000,
      },
    };
  },
});

export const connectionFor = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: (ctx, { orgId }) =>
    ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first(),
});

export const saveTokens = internalMutation({
  args: { orgId: v.id("organizations"), accessTokenEnc: v.bytes(), refreshTokenEnc: v.bytes(), expiresAt: v.number() },
  handler: async (ctx, { orgId, ...tokens }) => {
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (connection) await ctx.db.patch(connection._id, tokens);
  },
});

export const markExpired = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (!connection) return;
    await ctx.db.patch(connection._id, { status: "expired" });
    await audit(ctx, orgId, {
      actor: "Ledgerline",
      action: "lost access to",
      target: connection.tenantName,
      detail: "Xero rejected the refresh token. Reconnect to resume syncing.",
      icon: "error",
      tone: "negative",
    });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const { org, who } = await requireOrg(ctx, { owner: true });
    const connection = await ctx.db
      .query("xeroConnections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!connection) return;
    await ctx.db.patch(connection._id, { status: "revoked" });
    await audit(ctx, org._id, { actor: who.name, action: "disconnected", target: connection.tenantName, detail: "Figures from the last sync are kept", icon: "error", tone: "negative" });
  },
});

export const webhookTenants = internalMutation({
  args: { tenantIds: v.array(v.string()) },
  handler: async (ctx, { tenantIds }) => {
    for (const tenantId of new Set(tenantIds)) {
      const connections = await ctx.db
        .query("xeroConnections")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      for (const connection of connections) {
        if (connection.status !== "connected") continue;
        // Debounce: bursts of webhooks collapse into one incremental sync 30 seconds later.
        await ctx.scheduler.runAfter(30_000, internal.sync.enqueue, { orgId: connection.orgId, trigger: "Webhook: Xero change" });
      }
    }
  },
});
