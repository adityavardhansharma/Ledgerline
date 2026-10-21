import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { Tokens } from "../xero";
import { encrypt } from "./crypto";

/** Any engine call may refresh Xero's tokens; store the rotated pair before anything else. */
export async function persistRotated(ctx: ActionCtx, orgId: Id<"organizations">, tokens: Tokens | undefined) {
  if (!tokens) return;
  await ctx.runMutation(internal.xero.saveTokens, {
    orgId,
    accessTokenEnc: await encrypt(tokens.access_token),
    refreshTokenEnc: await encrypt(tokens.refresh_token),
    expiresAt: tokens.expires_at * 1000,
  });
}
