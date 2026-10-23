import { ConvexError, type Value } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * The Free plan, the only one for now: two companies per person, and a monthly AI allowance per company shared
 * by its team. Every model call is already logged in aiUsage; the allowance is counted from those rows, and it
 * resets at the start of each calendar month (UTC). Answers kept in the cache cost nothing and never count.
 */

export const FREE = { name: "Free", companies: 2, actions: 20, searches: 100, chats: 50 } as const;

export type Meter = "actions" | "searches" | "chats";

/** Which allowance a logged model call draws on. Everything that isn't a search or a chat is an AI action. */
export const meterOf = (action: string): Meter => (action === "chat" ? "chats" : action === "search" ? "searches" : "actions");

export const monthStart = (now = Date.now()) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};
export const nextReset = (now = Date.now()) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const resetDay = (at: number) => `${new Date(at).getUTCDate()} ${MONTHS[new Date(at).getUTCMonth()]}`;

const NOUN: Record<Meter, string> = { actions: "AI actions", searches: "AI searches", chats: "AI chats" };

/** What the person reads when an allowance runs out. */
export const pausedMessage = (meter: Meter, resetsAt = nextReset()) =>
  `You've used this month's ${FREE[meter]} ${NOUN[meter]} on the Free plan. New ${meter === "searches" ? "searches" : "answers"} are paused until your allowance resets on ${resetDay(resetsAt)}.`;

export type LimitError = { code: "limit"; meter: Meter; message: string; resetsAt: number; last?: Value };

export async function usage(ctx: QueryCtx, orgId: Id<"organizations">, now = Date.now()) {
  const rows = await ctx.db
    .query("aiUsage")
    .withIndex("by_org_at", (q) => q.eq("orgId", orgId).gte("at", monthStart(now)))
    .collect();
  const used: Record<Meter, number> = { actions: 0, searches: 0, chats: 0 };
  for (const row of rows) used[meterOf(row.action)]++;
  return { used, resetsAt: nextReset(now) };
}

/** How many calls of this kind are left this month. */
export async function remaining(ctx: QueryCtx, orgId: Id<"organizations">, meter: Meter) {
  const { used, resetsAt } = await usage(ctx, orgId);
  return { left: Math.max(0, FREE[meter] - used[meter]), resetsAt };
}

export function limitError(meter: Meter, resetsAt: number, last?: Value | null) {
  const data: LimitError = { code: "limit", meter, message: pausedMessage(meter, resetsAt), resetsAt };
  if (last != null) data.last = last;
  return new ConvexError(data);
}

/** Throw the paused message when the allowance for this kind of call has run out. */
export async function requireAllowance(ctx: QueryCtx, orgId: Id<"organizations">, meter: Meter) {
  const { left, resetsAt } = await remaining(ctx, orgId, meter);
  if (left <= 0) throw limitError(meter, resetsAt);
}
