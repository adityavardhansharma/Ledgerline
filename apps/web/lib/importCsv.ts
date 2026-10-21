/**
 * Read a chart of accounts and a journal listing from CSV into the records Convex stores for a Xero sync.
 * Everything is checked here, in the browser, so a bad file is explained before anything is uploaded:
 * unknown account types, accounts that aren't in the chart, dates that don't exist, amounts that don't
 * parse and journals that don't balance.
 *
 * Positive net amounts are debits, as in Xero. Money is integer cents throughout.
 */

export interface ImportAccount {
  xeroAccountId: string;
  code: string;
  name: string;
  type: string;
  accountClass: string;
  systemAccount: string;
  status: string;
}

export interface ImportLine {
  xero_account_id: string;
  net_cents: number;
  description: string;
  contact?: string;
}

export interface ImportJournal {
  xero_journal_id: string;
  journal_number: number;
  date: string;
  source_type: string;
  reference: string;
  lines: ImportLine[];
}

export interface ImportIssue {
  row?: number;
  message: string;
}

export interface AccountsResult {
  accounts: ImportAccount[];
  errors: ImportIssue[];
  warnings: string[];
}

export interface JournalsResult {
  journals: ImportJournal[];
  lineCount: number;
  from: string | null;
  to: string | null;
  debitCents: number;
  errors: ImportIssue[];
}

const CLASS_OF: Record<string, string> = {
  BANK: "ASSET",
  CURRENT: "ASSET",
  INVENTORY: "ASSET",
  FIXED: "ASSET",
  NONCURRENT: "ASSET",
  PREPAYMENT: "ASSET",
  CURRLIAB: "LIABILITY",
  LIABILITY: "LIABILITY",
  TERMLIAB: "LIABILITY",
  PAYGLIABILITY: "LIABILITY",
  SUPERANNUATIONLIABILITY: "LIABILITY",
  WAGESPAYABLELIABILITY: "LIABILITY",
  EQUITY: "EQUITY",
  REVENUE: "REVENUE",
  SALES: "REVENUE",
  OTHERINCOME: "REVENUE",
  DIRECTCOSTS: "EXPENSE",
  EXPENSE: "EXPENSE",
  OVERHEADS: "EXPENSE",
  DEPRECIATN: "EXPENSE",
  WAGESEXPENSE: "EXPENSE",
  SUPERANNUATIONEXPENSE: "EXPENSE",
};

// Words people use for account types, mapped to Xero's codes.
const TYPE_ALIASES: Record<string, string> = {
  CURRENTASSET: "CURRENT",
  STOCK: "INVENTORY",
  FIXEDASSET: "FIXED",
  NONCURRENTASSET: "NONCURRENT",
  CURRENTLIABILITY: "CURRLIAB",
  LONGTERMLIABILITY: "TERMLIAB",
  NONCURRENTLIABILITY: "TERMLIAB",
  LOAN: "TERMLIAB",
  INCOME: "REVENUE",
  DIRECTCOST: "DIRECTCOSTS",
  COSTOFSALES: "DIRECTCOSTS",
  OVERHEAD: "OVERHEADS",
  DEPRECIATION: "DEPRECIATN",
  WAGES: "WAGESEXPENSE",
};

export const ACCOUNT_TYPES = Object.keys(CLASS_OF);

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Find each wanted column by any of its names. Returns the column index or -1. */
function columns(header: string[], wanted: Record<string, string[]>) {
  const keys = header.map(key);
  const out: Record<string, number> = {};
  for (const [name, aliases] of Object.entries(wanted)) out[name] = keys.findIndex((k) => aliases.includes(k));
  return out;
}

export function normaliseType(raw: string): string | null {
  const t = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (CLASS_OF[t]) return t;
  return TYPE_ALIASES[t] ?? null;
}

export function readAccounts(text: string): AccountsResult {
  const rows = parseCsv(text);
  const errors: ImportIssue[] = [];
  const warnings: string[] = [];
  if (rows.length < 2) return { accounts: [], errors: [{ message: "The chart of accounts is empty." }], warnings };
  const col = columns(rows[0], {
    code: ["code", "accountcode", "accountnumber", "number"],
    name: ["name", "accountname", "account"],
    type: ["type", "accounttype"],
    system: ["system", "systemaccount"],
  });
  for (const need of ["code", "name", "type"] as const) {
    if (col[need] < 0) errors.push({ message: `The chart of accounts needs a "${need[0].toUpperCase()}${need.slice(1)}" column.` });
  }
  if (errors.length) return { accounts: [], errors, warnings };

  const seen = new Set<string>();
  const accounts: ImportAccount[] = [];
  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const code = (r[col.code] ?? "").trim();
    const name = (r[col.name] ?? "").trim();
    const type = normaliseType(r[col.type] ?? "");
    if (!code) return errors.push({ row, message: "Account code is missing." });
    if (seen.has(code)) return errors.push({ row, message: `Account ${code} appears twice.` });
    if (!type) return errors.push({ row, message: `"${r[col.type]}" isn't an account type. Use one of ${ACCOUNT_TYPES.slice(0, 8).join(", ")}…` });
    seen.add(code);
    accounts.push({
      xeroAccountId: `csv:${code}`,
      code,
      name: name || code,
      type,
      accountClass: CLASS_OF[type],
      systemAccount: col.system >= 0 ? (r[col.system] ?? "").trim().toUpperCase() : "",
      status: "ACTIVE",
    });
  });

  // Debtors and creditors are found by their system account, as in Xero. Infer them from the name if missing.
  for (const [system, pattern, cls] of [
    ["DEBTORS", /debtor|receivable/i, "ASSET"],
    ["CREDITORS", /creditor|payable/i, "LIABILITY"],
  ] as const) {
    if (accounts.some((a) => a.systemAccount === system)) continue;
    const guess = accounts.find((a) => a.accountClass === cls && pattern.test(a.name));
    if (guess) {
      guess.systemAccount = system;
      warnings.push(`Treated ${guess.code} ${guess.name} as ${system === "DEBTORS" ? "trade debtors" : "trade creditors"}.`);
    }
  }
  if (!accounts.some((a) => a.type === "BANK")) warnings.push("No account has the type BANK, so cash will show as zero.");
  return { accounts, errors, warnings };
}

/** "1,234.50", "€1234.5", "(80.00)", "-80" → cents. Null when empty, NaN when unreadable. */
export function parseAmount(raw: string | undefined): number | null {
  let s = (raw ?? "").trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[€£$\s,]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return Number.NaN;
  const value = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return negative ? -value : value;
}

/** "2026-09-30", "30/09/2026", "30-09-2026", "2026-09-30T00:00:00" → "2026-09-30". Null when invalid. */
export function parseDate(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

const euros = (cents: number) => `€${(Math.abs(cents) / 100).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function readJournals(text: string, accounts: ImportAccount[]): JournalsResult {
  const empty = { journals: [], lineCount: 0, from: null, to: null, debitCents: 0 };
  const rows = parseCsv(text);
  if (rows.length < 2) return { ...empty, errors: [{ message: "The journal file is empty." }] };
  const col = columns(rows[0], {
    journal: ["journal", "journalnumber", "journalno", "journalid", "entry", "entrynumber", "transaction", "transactionid"],
    date: ["date", "journaldate", "transactiondate"],
    account: ["account", "accountcode", "code"],
    description: ["description", "narration", "memo", "details"],
    debit: ["debit", "dr", "debitamount"],
    credit: ["credit", "cr", "creditamount"],
    amount: ["amount", "net", "netamount", "value"],
    reference: ["reference", "ref"],
    source: ["source", "sourcetype", "type"],
    contact: ["contact", "contactname", "customer", "supplier", "payee"],
  });
  const errors: ImportIssue[] = [];
  if (col.journal < 0) errors.push({ message: 'The journal file needs a "Journal" column that groups lines into entries.' });
  if (col.date < 0) errors.push({ message: 'The journal file needs a "Date" column.' });
  if (col.account < 0) errors.push({ message: 'The journal file needs an "Account" column with account codes.' });
  if (col.amount < 0 && (col.debit < 0 || col.credit < 0)) errors.push({ message: 'The journal file needs "Debit" and "Credit" columns, or a signed "Amount" column.' });
  if (errors.length) return { ...empty, errors };

  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const unknown = new Map<string, number[]>();
  // Journals with a rejected line aren't checked for balance too; the line's own error explains it.
  const tainted = new Set<string>();
  const groups = new Map<string, { date: string; reference: string; source: string; lines: ImportLine[]; firstRow: number }>();

  rows.slice(1).forEach((r, i) => {
    const row = i + 2;
    const id = (r[col.journal] ?? "").trim();
    if (!id) return errors.push({ row, message: "Journal number is missing." });
    const date = parseDate(r[col.date]);
    if (!date) return tainted.add(id), errors.push({ row, message: `"${r[col.date] ?? ""}" isn't a date. Use YYYY-MM-DD or DD/MM/YYYY.` });
    const code = (r[col.account] ?? "").trim();
    const account = byCode.get(code);
    if (!account) {
      unknown.set(code, [...(unknown.get(code) ?? []), row]);
      tainted.add(id);
      return;
    }
    let net: number | null;
    if (col.amount >= 0 && (r[col.amount] ?? "").trim()) net = parseAmount(r[col.amount]);
    else {
      const debit = col.debit >= 0 ? parseAmount(r[col.debit]) : null;
      const credit = col.credit >= 0 ? parseAmount(r[col.credit]) : null;
      if (Number.isNaN(debit) || Number.isNaN(credit)) net = Number.NaN;
      else if (debit && credit) return tainted.add(id), errors.push({ row, message: "A line can have a debit or a credit, not both." });
      else net = (debit ?? 0) - (credit ?? 0);
    }
    if (net === null || Number.isNaN(net)) return tainted.add(id), errors.push({ row, message: "The amount isn't a number." });
    if (net === 0) return;

    const group = groups.get(id) ?? {
      date,
      reference: col.reference >= 0 ? (r[col.reference] ?? "").trim().slice(0, 200) : "",
      source: col.source >= 0 ? (r[col.source] ?? "").trim().toUpperCase().slice(0, 40) || "IMPORT" : "IMPORT",
      lines: [],
      firstRow: row,
    };
    if (group.date !== date) return tainted.add(id), errors.push({ row, message: `Journal ${id} has lines on ${group.date} and ${date}. A journal has one date.` });
    const contact = col.contact >= 0 ? (r[col.contact] ?? "").trim().slice(0, 200) : "";
    group.lines.push({ xero_account_id: account.xeroAccountId, net_cents: net, description: (col.description >= 0 ? r[col.description] ?? "" : "").trim().slice(0, 500), ...(contact ? { contact } : {}) });
    groups.set(id, group);
  });

  for (const [code, at] of unknown) {
    errors.push({ row: at[0], message: `Account ${code || "(blank)"} isn't in the chart of accounts (${at.length} line${at.length === 1 ? "" : "s"}).` });
  }

  // Journals keep their own numbers when they are whole numbers; otherwise they are numbered in date order.
  const ids = [...groups.keys()];
  const numeric = ids.every((id) => /^\d+$/.test(id)) && new Set(ids.map(Number)).size === ids.length;
  const ordered = ids.map((id) => ({ id, ...groups.get(id)! })).sort((a, b) => (numeric ? Number(a.id) - Number(b.id) : a.date.localeCompare(b.date) || a.firstRow - b.firstRow));

  const journals: ImportJournal[] = [];
  let lineCount = 0;
  let debitCents = 0;
  ordered.forEach((g, i) => {
    if (tainted.has(g.id)) return;
    const total = g.lines.reduce((sum, l) => sum + l.net_cents, 0);
    if (total !== 0) {
      const debits = g.lines.filter((l) => l.net_cents > 0).reduce((s, l) => s + l.net_cents, 0);
      errors.push({ row: g.firstRow, message: `Journal ${g.id} doesn't balance: debits ${euros(debits)}, credits ${euros(debits - total)}.` });
      return;
    }
    const number = numeric ? Number(g.id) : i + 1;
    journals.push({ xero_journal_id: `csv:${number}`, journal_number: number, date: g.date, source_type: g.source, reference: g.reference, lines: g.lines });
    lineCount += g.lines.length;
    debitCents += g.lines.filter((l) => l.net_cents > 0).reduce((s, l) => s + l.net_cents, 0);
  });

  const dates = journals.map((j) => j.date).sort();
  errors.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  return { journals, lineCount, from: dates[0] ?? null, to: dates.at(-1) ?? null, debitCents, errors };
}

/** Split journals into uploads of at most `maxLines` lines, never splitting a journal. */
export function batches(journals: ImportJournal[], maxLines = 800): ImportJournal[][] {
  const out: ImportJournal[][] = [];
  let current: ImportJournal[] = [];
  let lines = 0;
  for (const j of journals) {
    if (current.length && lines + j.lines.length > maxLines) {
      out.push(current);
      current = [];
      lines = 0;
    }
    current.push(j);
    lines += j.lines.length;
  }
  if (current.length) out.push(current);
  return out;
}
