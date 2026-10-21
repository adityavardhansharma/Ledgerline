// int64 cents in the database, plain numbers at the engine and UI boundary.

export function toNumber(cents: bigint): number {
  const n = Number(cents);
  if (!Number.isSafeInteger(n)) throw new Error("amount outside the safe range");
  return n;
}

export const periodOf = (date: string) => date.slice(0, 7);

/** The last complete calendar month, e.g. 2026-09 on 21 Oct 2026. */
export function lastCompleteMonth(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
