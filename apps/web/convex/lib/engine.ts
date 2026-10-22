// Signed calls from Convex actions to the stateless finance engine.
import { hmacHex } from "./crypto";

export class EngineError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(`engine ${status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  get retryAfter(): number {
    return Number(this.body.retryAfter ?? 60);
  }
  get needsReauth(): boolean {
    return this.status === 401 && this.body.error === "reauth";
  }
}

export async function engine<T = Record<string, unknown>>(path: string, payload: unknown): Promise<T> {
  const base = process.env.LL_ENGINE_URL;
  const secret = process.env.LL_ENGINE_SECRET;
  if (!base || !secret) throw new Error("LL_ENGINE_URL and LL_ENGINE_SECRET must be set on the Convex deployment");
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const message = new TextEncoder().encode(`${timestamp}.POST.${path}.${body}`);
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ll-timestamp": String(timestamp),
      "x-ll-signature": await hmacHex(secret, message),
    },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new EngineError(response.status, json);
  return json as T;
}

/** A signed call whose response is streamed back (the chat's model turns). */
export async function engineStream(path: string, payload: unknown, signal?: AbortSignal): Promise<Response> {
  const base = process.env.LL_ENGINE_URL;
  const secret = process.env.LL_ENGINE_SECRET;
  if (!base || !secret) throw new Error("LL_ENGINE_URL and LL_ENGINE_SECRET must be set on the Convex deployment");
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const message = new TextEncoder().encode(`${timestamp}.POST.${path}.${body}`);
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: { "content-type": "application/json", "x-ll-timestamp": String(timestamp), "x-ll-signature": await hmacHex(secret, message) },
    body,
    signal,
  });
  if (!response.ok || !response.body) {
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new EngineError(response.status, json);
  }
  return response;
}
