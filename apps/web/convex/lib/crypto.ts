// AES-GCM encryption for Xero tokens at rest. The key lives only in the Convex environment (LL_TOKEN_KEY).

function key(): Promise<CryptoKey> {
  const raw = process.env.LL_TOKEN_KEY;
  if (!raw) throw new Error("LL_TOKEN_KEY is not set");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("LL_TOKEN_KEY must be 32 bytes, base64 encoded");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(plain: string): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return out.buffer;
}

export async function decrypt(sealed: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(sealed);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, await key(), bytes.slice(12));
  return new TextDecoder().decode(plain);
}

export function randomString(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(raw);
}

export function base64url(data: Uint8Array): string {
  let s = "";
  for (const b of data) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

export async function hmacHex(secret: string, message: Uint8Array<ArrayBuffer>): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, message));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacBase64(secret: string, message: Uint8Array<ArrayBuffer>): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, message));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s);
}

/** Constant-time comparison for signatures. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
