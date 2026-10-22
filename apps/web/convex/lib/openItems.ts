import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { toNumber } from "./money";

/**
 * Unpaid invoices and bills from imported journals, so the "owed to you" view and payment reminders work without
 * Xero. An invoice is an ACCREC (or ACCPAY) posting to trade debtors (or creditors); payments with the same
 * reference settle it. Due dates aren't in a journal listing, so terms of thirty days are assumed.
 */
export interface OpenItem {
  kind: "receivable" | "payable";
  contact: string;
  number: string;
  date: string;
  dueDate: string;
  amountDueCents: number;
}

const TERMS_DAYS = 30;
const BUCKETS: [string, number | null, number | null][] = [
  ["Not yet due", null, 0],
  ["1–30 days overdue", 1, 30],
  ["31–60 days overdue", 31, 60],
  ["61–90 days overdue", 61, 90],
  ["Over 90 days", 91, null],
];

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function importedOpenItems(ctx: QueryCtx, orgId: Id<"organizations">): Promise<OpenItem[] | null> {
  const accounts = await ctx.db
    .query("accounts")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const out: OpenItem[] = [];
  let invoices = false;
  for (const [kind, system, source, sign] of [
    ["receivable", "DEBTORS", "ACCREC", 1],
    ["payable", "CREDITORS", "ACCPAY", -1],
  ] as const) {
    const control = accounts.filter((a) => a.systemAccount === system);
    const groups = new Map<string, { contact: string; date: string; cents: number; invoiced: boolean }>();
    for (const account of control) {
      const lines = await ctx.db
        .query("ledgerLines")
        .withIndex("by_org_account_period", (q) => q.eq("orgId", orgId).eq("xeroAccountId", account.xeroAccountId))
        .take(20_000);
      for (const line of lines) {
        if (!line.reference) continue;
        const group = groups.get(line.reference) ?? { contact: "", date: line.date, cents: 0, invoiced: false };
        group.cents += sign * toNumber(line.netCents);
        if (line.sourceType === source) {
          group.invoiced = true;
          group.date = line.date;
          group.contact = line.contact ?? group.contact;
        }
        groups.set(line.reference, group);
      }
    }
    for (const [number, g] of groups) {
      if (!g.invoiced) continue;
      invoices = true;
      if (g.cents > 0) out.push({ kind, contact: g.contact || "Unnamed", number, date: g.date, dueDate: addDays(g.date, TERMS_DAYS), amountDueCents: g.cents });
    }
  }
  return invoices ? out : null;
}

/** The same shape as Xero's ageing: buckets by days overdue and the five largest balances by contact. */
export function ageItems(items: OpenItem[], asOf: string) {
  const today = Date.parse(`${asOf}T00:00:00Z`);
  const result: Record<string, unknown> = { asOf, source: "journals", assumedTermsDays: TERMS_DAYS };
  for (const kind of ["receivable", "payable"] as const) {
    const totals = BUCKETS.map(() => 0);
    const byContact = new Map<string, number>();
    for (const item of items.filter((i) => i.kind === kind)) {
      const overdue = Math.round((today - Date.parse(`${item.dueDate}T00:00:00Z`)) / 86_400_000);
      const index = BUCKETS.findIndex(([, low, high]) => (low === null ? overdue <= 0 : overdue >= low && (high === null || overdue <= high)));
      totals[index] += item.amountDueCents;
      byContact.set(item.contact, (byContact.get(item.contact) ?? 0) + item.amountDueCents);
    }
    result[kind] = BUCKETS.map(([label], i) => ({ label, value: totals[i] }));
    result[`${kind}Top`] = [...byContact].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([contact, value]) => ({ contact, value }));
  }
  return result;
}

export const monthEnd = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
