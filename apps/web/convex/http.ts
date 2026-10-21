import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { hmacBase64, safeEqual } from "./lib/crypto";

const http = httpRouter();

const site = () => process.env.SITE_URL ?? "http://localhost:3000";

http.route({
  path: "/xero/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    if (error || !code || !state) {
      return Response.redirect(`${site()}/onboarding?xero=${encodeURIComponent(error ?? "cancelled")}`, 302);
    }
    try {
      const result = await ctx.runAction(internal.xero.finishConnect, { code, state });
      return Response.redirect(result.ok ? `${site()}/data/sync?connected=1` : `${site()}/onboarding?xero=${result.reason}`, 302);
    } catch (err) {
      console.error("Xero callback failed", err);
      return Response.redirect(`${site()}/onboarding?xero=failed`, 302);
    }
  }),
});

// Xero signs the raw body with the webhook key (HMAC-SHA256, base64). The same check answers its
// intent-to-receive probe: 200 for a valid signature, 401 otherwise, empty body, within 5 seconds.
http.route({
  path: "/xero/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const key = process.env.XERO_WEBHOOK_KEY;
    const raw = new Uint8Array(await request.arrayBuffer());
    const given = request.headers.get("x-xero-signature") ?? "";
    if (!key || !safeEqual(await hmacBase64(key, raw), given)) return new Response(null, { status: 401 });
    try {
      const payload = JSON.parse(new TextDecoder().decode(raw)) as { events?: { tenantId?: string }[] };
      const tenantIds = (payload.events ?? []).map((e) => e.tenantId).filter((t): t is string => Boolean(t));
      if (tenantIds.length) await ctx.runMutation(internal.xero.webhookTenants, { tenantIds });
    } catch (err) {
      console.error("Bad webhook payload", err);
    }
    return new Response(null, { status: 200 });
  }),
});

export default http;
