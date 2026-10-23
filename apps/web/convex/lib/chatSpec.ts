/**
 * The tools Ledgerline's chat can use, described once. The model calls them to read figures while it thinks
 * (function calling, run in Convex), and its answer can bind charts and tiles to them with Query(), which the
 * browser runs against the same Convex queries. Money is in euros, percentages are in percent (42.3 = 42.3%).
 */

type Json = Record<string, unknown>;
export interface ChatTool {
  name: string;
  description: string;
  status: string;
  input: Json;
  output: Json;
  defaults: Json;
}

const month = { type: "string", description: "A month as YYYY-MM; omit for the latest month" };
const rows = (item: Json) => ({ type: "array", items: { type: "object", properties: item } });
const num = { type: "number" };
const str = { type: "string" };

export const CHAT_TOOLS: ChatTool[] = [
  {
    name: "company_overview",
    description: "Headline figures for the latest month: revenue, margins, profit, cash, what customers owe, debtor and creditor days, runway on current burn.",
    status: "Reading the headline figures",
    input: { type: "object", properties: {} },
    output: {
      type: "object",
      properties: {
        company: str, month: str, monthLabel: str, revenue: num, revenueChangePct: num, grossMarginPct: num, ebitda: num, netProfit: num,
        cash: num, cashChangePct: num, owedByCustomers: num, owedToSuppliers: num, debtorDays: num, creditorDays: num, currentRatio: num, runwayMonths: num,
      },
    },
    defaults: { monthLabel: "", revenue: 0, grossMarginPct: 0, ebitda: 0, netProfit: 0, cash: 0, owedByCustomers: 0, debtorDays: 0 },
  },
  {
    name: "monthly_trend",
    description: "One measure month by month, oldest first, for up to 24 months of actuals.",
    status: "Reading the monthly trend",
    input: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["revenue", "grossProfit", "ebitda", "netProfit", "cash", "overheads"] },
        months: { type: "number", description: "How many months, 3 to 24 (default 12)" },
      },
      required: ["metric"],
    },
    output: { type: "object", properties: { metric: str, rows: rows({ month: str, label: str, value: num }) } },
    defaults: { rows: [] },
  },
  {
    name: "profit_and_loss",
    description: "Every income and cost account for a month and for the financial year to date, with subtotals.",
    status: "Reading the profit and loss",
    input: { type: "object", properties: { month } },
    output: { type: "object", properties: { month: str, rows: rows({ account: str, kind: str, month: num, yearToDate: num }) } },
    defaults: { rows: [] },
  },
  {
    name: "account_detail",
    description: "One account (matched by name or code) month by month, and its largest transactions in the latest month.",
    status: "Looking into the account",
    input: { type: "object", properties: { account: { type: "string", description: "Account name or code" }, months: num }, required: ["account"] },
    output: {
      type: "object",
      properties: { account: str, rows: rows({ month: str, label: str, value: num }), largest: rows({ date: str, description: str, contact: str, amount: num }) },
    },
    defaults: { rows: [], largest: [] },
  },
  {
    name: "cost_breakdown",
    description: "Operating costs by account for the financial year to date, largest first, with each one's share.",
    status: "Breaking down the costs",
    input: { type: "object", properties: {} },
    output: { type: "object", properties: { total: num, rows: rows({ account: str, value: num, sharePct: num }) } },
    defaults: { total: 0, rows: [] },
  },
  {
    name: "forecast",
    description: "A scenario's forecast (the base case unless named): runway, when cash runs out, the lowest cash point, and month-by-month cash, revenue and EBITDA.",
    status: "Running through the forecast",
    input: { type: "object", properties: { scenario: { type: "string", description: "Scenario name; omit for the base case" } } },
    output: {
      type: "object",
      properties: {
        scenario: str, runwayMonths: num, cashOutMonth: str, lowestCash: num, lowestMonth: str,
        rows: rows({ month: str, label: str, cash: num, revenue: num, ebitda: num }),
      },
    },
    defaults: { rows: [] },
  },
  {
    name: "scenarios",
    description: "Every scenario with what it changes, its runway and its cash in twelve months.",
    status: "Comparing the scenarios",
    input: { type: "object", properties: {} },
    output: { type: "object", properties: { rows: rows({ name: str, isBase: { type: "boolean" }, changes: str, runwayMonths: num, cashIn12Months: num }) } },
    defaults: { rows: [] },
  },
  {
    name: "owed_to_you",
    description: "What customers owe, by how overdue it is, and the customers owing most.",
    status: "Checking who owes you",
    input: { type: "object", properties: {} },
    output: { type: "object", properties: { total: num, overdue: num, buckets: rows({ label: str, value: num }), customers: rows({ name: str, value: num }) } },
    defaults: { total: 0, buckets: [], customers: [] },
  },
  {
    name: "top_customers",
    description: "Sales by customer over the last few months, largest first, with each one's share (when the books name customers).",
    status: "Ranking the customers",
    input: { type: "object", properties: { months: { type: "number", description: "1 to 12 (default 3)" } } },
    output: { type: "object", properties: { total: num, rows: rows({ name: str, value: num, sharePct: num }) } },
    defaults: { total: 0, rows: [] },
  },
];

export const toolNamed = (name: string) => CHAT_TOOLS.find((t) => t.name === name);

/** The same tools in the OpenAI function-calling shape OpenRouter expects. */
export const functionTools = (only?: readonly string[]) =>
  CHAT_TOOLS.filter((t) => !only || only.includes(t.name)).map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input } }));

/** The same tools in the shape OpenUI's prompt generator expects. */
export const openUiTools = () =>
  CHAT_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input, outputSchema: t.output, defaults: t.defaults }));

/** What people can point the chat at, each a group of tools. Nothing chosen means everything. */
export const CHAT_SOURCES = [
  { id: "headline", label: "Headline figures", hint: "Cash, revenue, profit, margins, debtor days", icon: "overview", tools: ["company_overview"] },
  { id: "trends", label: "Trends", hint: "Any figure month by month", icon: "trend-up", tools: ["monthly_trend"] },
  { id: "pnl", label: "Profit and loss", hint: "The statement and where costs go", icon: "statement", tools: ["profit_and_loss", "cost_breakdown"] },
  { id: "ledger", label: "Ledger", hint: "One account, line by line", icon: "ledger", tools: ["account_detail"] },
  { id: "forecast", label: "Forecast and scenarios", hint: "Cash ahead, runway, your plans", icon: "forecast", tools: ["forecast", "scenarios"] },
  { id: "customers", label: "Customers", hint: "Who owes you and who buys most", icon: "team", tools: ["owed_to_you", "top_customers"] },
] as const;

/** The tool names a set of chosen sources allows; every tool when none are chosen. */
export function allowedTools(sources: readonly string[] | undefined): string[] {
  const chosen = CHAT_SOURCES.filter((s) => sources?.includes(s.id));
  return chosen.length ? chosen.flatMap((s) => [...s.tools]) : CHAT_TOOLS.map((t) => t.name);
}
