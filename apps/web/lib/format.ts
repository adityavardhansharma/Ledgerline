import { formatMoney, formatPct } from "@ledgerline/ui";

/** Engine and Convex move money as integer cents; the UI formats major units. */
export const euros = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

export const money = (cents: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}) =>
  cents == null ? "–" : formatMoney(cents / 100, opts);

export const pct = (value: number | null | undefined, decimals = 1) => (value == null ? "–" : formatPct(value, decimals));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const periodLabel = (period: string, withYear = true) =>
  `${MONTHS[Number(period.slice(5, 7)) - 1]}${withYear ? ` ${period.slice(0, 4)}` : ""}`;

/** "September", for prose. */
export const monthName = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-IE", { month: "long", timeZone: "UTC" });

export const ago = (ms: number | null | undefined, now = Date.now()) => {
  if (!ms) return "never";
  const minutes = Math.round((now - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
};
