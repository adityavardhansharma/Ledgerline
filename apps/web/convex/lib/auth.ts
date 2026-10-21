import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type Role = "owner" | "editor" | "accountant";

export interface Caller {
  userId: string;
  name: string;
  clerkOrgId: string;
  orgName: string;
  role: Role;
}

function roleOf(claim: unknown): Role {
  if (claim === "org:admin") return "owner";
  if (claim === "org:accountant") return "accountant";
  return "editor";
}

/** Who is calling, in which organisation. Null when signed out or no organisation is active. */
export async function caller(ctx: QueryCtx | MutationCtx): Promise<Caller | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const claims = identity as unknown as Record<string, unknown>;
  const clerkOrgId = typeof claims.org_id === "string" ? claims.org_id : "";
  if (!clerkOrgId) return null;
  return {
    userId: identity.subject,
    name: identity.name ?? identity.email ?? "Someone",
    clerkOrgId,
    orgName: typeof claims.org_name === "string" ? claims.org_name : "Your organisation",
    role: roleOf(claims.org_role),
  };
}

/** The caller's organisation, or null. Every query goes through this, so no read is ever unscoped. */
export async function currentOrg(ctx: QueryCtx | MutationCtx): Promise<{ who: Caller; org: Doc<"organizations"> } | null> {
  const who = await caller(ctx);
  if (!who) return null;
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_clerk", (q) => q.eq("clerkOrgId", who.clerkOrgId))
    .unique();
  return org ? { who, org } : null;
}

export async function requireOrg(ctx: QueryCtx | MutationCtx, opts: { write?: boolean; owner?: boolean } = {}) {
  const found = await currentOrg(ctx);
  if (!found) throw new ConvexError("Choose an organisation first.");
  if (opts.write && found.who.role === "accountant") throw new ConvexError("Accountants can read and comment, not change figures.");
  if (opts.owner && found.who.role !== "owner") throw new ConvexError("Only an owner can do this.");
  return found;
}
