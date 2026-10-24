import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { chatTurn, type ChatEvent } from "./chat";
import { httpAction } from "./_generated/server";
import { hmacBase64, safeEqual } from "./lib/crypto";

const http = httpRouter();

const site = () => process.env.SITE_URL ?? "http://localhost:3000";

http.route({
  path: "/xero/callback",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    if (error || !code || !state) {
      return Response.redirect(`${site()}/onboarding?xero=${encodeURIComponent(error ?? "cancelled")}`, 302);
    }
    // The signed-in app finishes the connection (xero.completeConnect), so it can check that the person who
    // signed in to Xero is the person who asked to connect.
    const next = new URL("/connect/xero", site());
    next.searchParams.set("code", code);
    next.searchParams.set("state", state);
    return new Response(null, { status: 302, headers: { Location: next.toString(), "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
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

// ---------- chat ----------

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  // SITE_URL plus any other origins the app is served from (CHAT_ORIGINS, comma separated); local ports in development.
  const local = site().startsWith("http://localhost") ? ["http://localhost:3000", "http://localhost:3123"] : [];
  const allowed = [site(), ...local, ...(process.env.CHAT_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean)];
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : site(),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

http.route({ path: "/chat", method: "OPTIONS", handler: httpAction(async (_ctx, request) => new Response(null, { status: 204, headers: corsHeaders(request) })) });

/** One chat turn as server-sent events. The Clerk session token in Authorization decides whose figures it sees. */
http.route({
  path: "/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);
    if (!(await ctx.auth.getUserIdentity())) return new Response(JSON.stringify({ error: "Sign in again." }), { status: 401, headers });
    let body: { text?: unknown; threadId?: unknown; page?: unknown; pageTitle?: unknown; sources?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Bad request." }), { status: 400, headers });
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 2000) return new Response(JSON.stringify({ error: "Ask a question of up to 2,000 characters." }), { status: 400, headers });
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    let open = true;
    const emit = async (event: ChatEvent) => {
      if (!open) return;
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      } catch {
        // The browser went away; keep going so the answer is still saved for when they come back.
        open = false;
      }
    };
    void (async () => {
      try {
        await chatTurn(ctx, {
          text,
          threadId: typeof body.threadId === "string" && body.threadId ? (body.threadId as never) : undefined,
          page: typeof body.page === "string" ? body.page.slice(0, 80) : undefined,
          pageTitle: typeof body.pageTitle === "string" ? body.pageTitle.slice(0, 80) : undefined,
          sources: Array.isArray(body.sources) ? body.sources.filter((s): s is string => typeof s === "string").slice(0, 12) : undefined,
        }, emit);
      } catch (err) {
        await emit({ type: "error", message: err instanceof Error && /not found/i.test(err.message) ? "That conversation is gone. Start a new one." : "Couldn't start the answer. Try again." });
      } finally {
        if (open) await writer.close().catch(() => undefined);
      }
    })();
    return new Response(readable, { status: 200, headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  }),
});

export default http;
