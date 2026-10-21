import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function audit(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  event: { actor: string; action: string; target?: string; detail?: string; icon: string; tone?: string },
) {
  await ctx.db.insert("auditEvents", { orgId, ...event, at: Date.now() });
}
