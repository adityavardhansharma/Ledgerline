import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = { subject: "user_aoife", name: "Aoife Byrne", org_id: "org_kestrel", org_role: "org:admin", org_name: "Kestrel Joinery Ltd" };
const ACCOUNTANT = { subject: "user_niamh", name: "Niamh O'Brien", org_id: "org_kestrel", org_role: "org:accountant", org_name: "Kestrel Joinery Ltd" };
const STRANGER = { subject: "user_other", name: "Someone Else", org_id: "org_other", org_role: "org:admin", org_name: "Other Ltd" };

beforeEach(() => {
  process.env.LL_TOKEN_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  process.env.LL_ENGINE_URL = "http://engine.test";
  process.env.LL_ENGINE_SECRET = "test-secret";
});
afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER as never);
  const orgId = await owner.mutation(api.orgs.ensure, {});
  if (!orgId) throw new Error("organisation not created");
  return { t, owner, orgId };
}

const journal = (n: number, date: string, lines: [string, number][]) => ({
  xero_journal_id: `j-${n}`,
  journal_number: n,
  date,
  source_type: "ACCREC",
  reference: `INV-${n}`,
  lines: lines.map(([account, cents]) => ({ xero_account_id: account, net_cents: cents, description: "" })),
});

describe("organisations", () => {
  it("creates one organisation per Clerk organisation and returns the caller's role", async () => {
    const { owner, orgId } = await setup();
    expect(await owner.mutation(api.orgs.ensure, {})).toEqual(orgId);
    const current = await owner.query(api.orgs.current, {});
    expect(current?.org.name).toBe("Kestrel Joinery Ltd");
    expect(current?.role).toBe("owner");
    expect(current?.connection).toBeNull();
  });

  it("only owners change settings", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.orgs.updateSettings, { fyStartMonth: 4 });
    expect((await owner.query(api.orgs.current, {}))?.org.fyStartMonth).toBe(4);
    await expect(t.withIdentity(ACCOUNTANT as never).mutation(api.orgs.updateSettings, { fyStartMonth: 1 })).rejects.toThrow(/owner/);
  });
});

describe("storing journals", () => {
  async function connected() {
    const ctx = await setup();
    await ctx.t.mutation(internal.sync.storeAccounts, {
      orgId: ctx.orgId,
      accounts: [
        { xeroAccountId: "bank", code: "1200", name: "Bank", type: "BANK", accountClass: "ASSET", systemAccount: "", status: "ACTIVE" },
        { xeroAccountId: "sales", code: "4000", name: "Sales", type: "REVENUE", accountClass: "REVENUE", systemAccount: "", status: "ACTIVE" },
      ],
    });
    const runId = await ctx.t.run((db) =>
      db.db.insert("syncRuns", { orgId: ctx.orgId, trigger: "Test", phase: "journals", status: "running", pagesDone: 0, journalsStored: 0, attempts: 0, startedAt: Date.now() }),
    );
    return { ...ctx, runId };
  }

  it("aggregates monthly balances and daily cash, and a retried page changes nothing", async () => {
    const { t, orgId, runId } = await connected();
    const page = [journal(1, "2026-09-02", [["bank", 4_860_000], ["sales", -4_860_000]]), journal(2, "2026-09-02", [["bank", 1_000], ["sales", -1_000]])];
    await t.mutation(internal.sync.storePage, { runId, orgId, journals: page });
    await t.mutation(internal.sync.storePage, { runId, orgId, journals: page });
    const input = await t.query(internal.reports.engineInput, { orgId });
    const sales = input.balances.find((b) => b.xero_account_id === "sales");
    expect(sales).toEqual({ xero_account_id: "sales", period: "2026-09", net_cents: -4_861_000 });
    const lines = await t.run((ctx) => ctx.db.query("ledgerLines").collect());
    expect(lines).toHaveLength(4);
    const cash = await t.run((ctx) => ctx.db.query("dailyCash").collect());
    expect(cash.map((c) => [c.date, Number(c.netCents)])).toEqual([["2026-09-02", 4_861_000]]);
  });

  it("refuses a journal that doesn't balance", async () => {
    const { t, orgId, runId } = await connected();
    await expect(t.mutation(internal.sync.storePage, { runId, orgId, journals: [journal(3, "2026-09-03", [["bank", 100], ["sales", -99]])] })).rejects.toThrow(/does not balance/);
  });

  it("drill-down returns the lines behind a figure, for the caller's organisation only", async () => {
    const { t, owner, orgId, runId } = await connected();
    await t.mutation(internal.sync.storePage, { runId, orgId, journals: [journal(5, "2026-09-10", [["bank", 250_000], ["sales", -250_000]])] });
    const drill = await owner.query(api.ledger.lines, { xeroAccountId: "sales", period: "2026-09" });
    expect(drill?.lines).toEqual([expect.objectContaining({ creditCents: 250_000, debitCents: 0, journalNumber: 5 })]);
    const stranger = t.withIdentity(STRANGER as never);
    expect(await stranger.query(api.ledger.lines, { xeroAccountId: "sales", period: "2026-09" })).toBeNull();
  });
});

describe("scenarios", () => {
  it("branches inherit and override like Git branches", async () => {
    const { t, owner, orgId } = await setup();
    const baseId = await t.mutation(internal.scenarios.ensureBase, { orgId });
    await owner.mutation(api.scenarios.setOverride, { id: baseId, key: "debtorDays", value: 35 });
    const hireId = await owner.mutation(api.scenarios.branch, { fromId: baseId, name: "Hire two" });
    await owner.mutation(api.scenarios.setPlanItems, { id: hireId, hires: [{ id: "h1", role: "Maker", salaryCents: 6_750_000, startPeriod: "2027-01", count: 2 }] });
    const slowId = await owner.mutation(api.scenarios.branch, { fromId: hireId, name: "Hire two, slower collections" });
    await owner.mutation(api.scenarios.setOverride, { id: slowId, key: "debtorDays", value: 56 });

    const slow = await owner.query(api.scenarios.get, { id: slowId });
    expect(slow?.overrides).toEqual({ debtorDays: 56 });
    expect(slow?.inherited).toEqual({ debtorDays: 35 });
    expect(slow?.hires).toHaveLength(1);

    // Deleting the middle branch keeps its changes in the child.
    await owner.mutation(api.scenarios.remove, { id: hireId });
    const after = await owner.query(api.scenarios.get, { id: slowId });
    expect(after?.hires).toHaveLength(1);
    expect(after?.parentName).toBe("Base case");
  });

  it("validates drivers, protects the base case and blocks accountants", async () => {
    const { t, owner, orgId } = await setup();
    const baseId = await t.mutation(internal.scenarios.ensureBase, { orgId });
    await expect(owner.mutation(api.scenarios.setOverride, { id: baseId, key: "debtorDays", value: 900 })).rejects.toThrow(/between/);
    await expect(owner.mutation(api.scenarios.setOverride, { id: baseId, key: "magic", value: 1 })).rejects.toThrow(/Unknown driver/);
    await expect(owner.mutation(api.scenarios.remove, { id: baseId })).rejects.toThrow(/can't be deleted/);
    await expect(t.withIdentity(ACCOUNTANT as never).mutation(api.scenarios.branch, { fromId: baseId, name: "x" })).rejects.toThrow(/Accountants/);
    await expect(t.withIdentity(STRANGER as never).query(api.scenarios.get, { id: baseId })).resolves.toBeNull();
  });
});

describe("forecasts", () => {
  it("calls the engine once per distinct set of inputs and signs the request", async () => {
    const { t, owner, orgId } = await setup();
    const baseId = await t.mutation(internal.scenarios.ensureBase, { orgId });
    await t.mutation(internal.reports.storeSnapshot, {
      orgId,
      kind: "statements",
      bumpVersion: true,
      asOf: "2026-09",
      data: { drivers: { startPeriod: "2026-10", revenueLastMonth: 22_890_000, growth: 0, grossMargin: 0.42, debtorDays: 41, creditorDays: 32, stockDays: 0, overheadGrowth: 0.04, overheadsMonthly: 6_830_000, opening: { cash: 41_230_000 } } },
    });
    const calls: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Request(input, init));
      return new Response(JSON.stringify({ months: [], runwayMonths: 14, cashOutPeriod: "2027-12", lowestCash: 0, endCash: 0, revenueFirst12: 0, ebitdaFirst12: 0 }), { status: 200 });
    });
    expect(await owner.action(api.forecast.run, { scenarioId: baseId })).toEqual({ cached: false });
    expect(await owner.action(api.forecast.run, { scenarioId: baseId })).toEqual({ cached: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://engine.test/forecast/run");
    expect(calls[0].headers.get("x-ll-signature")).toMatch(/^[0-9a-f]{64}$/);
    const body = await calls[0].json();
    expect(body.drivers.debtorDays).toBe(41);

    await owner.mutation(api.scenarios.setOverride, { id: baseId, key: "debtorDays", value: 50 });
    expect(await owner.action(api.forecast.run, { scenarioId: baseId })).toEqual({ cached: false });
    expect(calls).toHaveLength(2);
    expect((await owner.query(api.forecast.latest, { scenarioId: baseId }))?.runwayMonths).toBe(14);
  });
});

describe("Xero webhooks", () => {
  it("rejects bad signatures and accepts good ones", async () => {
    process.env.XERO_WEBHOOK_KEY = "webhook-key";
    const t = convexTest(schema, modules);
    const body = JSON.stringify({ events: [{ tenantId: "tenant-1" }] });
    const bad = await t.fetch("/xero/webhook", { method: "POST", body, headers: { "x-xero-signature": "nope" } });
    expect(bad.status).toBe(401);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("webhook-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))));
    const good = await t.fetch("/xero/webhook", { method: "POST", body, headers: { "x-xero-signature": sig } });
    expect(good.status).toBe(200);
  });
});

describe("CSV imports", () => {
  const CHART = [
    { xeroAccountId: "csv:090", code: "090", name: "Bank", type: "BANK", accountClass: "ASSET", systemAccount: "", status: "ACTIVE" },
    { xeroAccountId: "csv:200", code: "200", name: "Sales", type: "REVENUE", accountClass: "REVENUE", systemAccount: "", status: "ACTIVE" },
  ];
  const csvJournal = (n: number, date: string, cents: number) => ({ ...journal(n, date, [["csv:090", cents], ["csv:200", -cents]]), xero_journal_id: `csv:${n}` });

  it("stores the chart and journals, builds reports and records the source", async () => {
    const { t, owner } = await setup();
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ asOf: "2026-09", fyStart: "2026-01" }), { status: 200 });
    });
    const runId = await owner.action(api.imports.start, { source: "csv", label: "books.csv", accounts: CHART });
    await owner.mutation(api.imports.page, { runId, journals: [csvJournal(1, "2026-08-04", 10_000), csvJournal(2, "2026-09-04", 25_000)] });
    await owner.mutation(api.imports.page, { runId, journals: [csvJournal(2, "2026-09-04", 25_000)] });
    await owner.action(api.imports.complete, { runId });

    expect(calls).toEqual(["http://engine.test/reports/build"]);
    const current = await owner.query(api.orgs.current, {});
    expect(current?.org).toMatchObject({ source: "csv", sourceLabel: "books.csv", asOf: "2026-09" });
    expect(current?.lastSync).toMatchObject({ status: "done", source: "csv", journalsStored: 2, trigger: "CSV import" });
    const lines = await t.run((ctx) => ctx.db.query("ledgerLines").collect());
    expect(lines).toHaveLength(4);
    const events = await owner.query(api.audit.list, { paginationOpts: { numItems: 10, cursor: null } });
    expect(events.page.map((e: { action: string }) => e.action)).toContain("imported");
  });

  it("replaces earlier figures, refuses foreign accounts, and keeps accountants out", async () => {
    const { t, owner } = await setup();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({}), { status: 200 }));
    const first = await owner.action(api.imports.start, { source: "csv", label: "a.csv", accounts: CHART });
    await owner.mutation(api.imports.page, { runId: first, journals: [csvJournal(1, "2026-08-04", 10_000)] });
    await owner.action(api.imports.complete, { runId: first });

    const second = await owner.action(api.imports.start, { source: "sample", label: "Kestrel Joinery Ltd", accounts: CHART.slice(0, 1) });
    expect(await t.run((ctx) => ctx.db.query("ledgerLines").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("accounts").collect())).toHaveLength(1);
    await expect(owner.mutation(api.imports.page, { runId: second, journals: [csvJournal(1, "2026-08-04", 10_000)] })).rejects.toThrow(/isn't in the chart/);
    await expect(owner.mutation(api.imports.page, { runId: second, journals: [{ ...csvJournal(2, "2026-08-04", 1), xero_journal_id: "x-2" }] })).rejects.toThrow(/from a file/);
    await expect(t.withIdentity(ACCOUNTANT as never).action(api.imports.start, { source: "csv", label: "x", accounts: CHART })).rejects.toThrow(/Accountants/);
    await expect(owner.action(api.imports.start, { source: "csv", label: "x", accounts: CHART })).rejects.toThrow(/already running/);
  });

  it("is refused while Xero is connected, and a Xero sync later claims the organisation", async () => {
    const { t, owner, orgId } = await setup();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({}), { status: 200 }));
    const runId = await owner.action(api.imports.start, { source: "csv", label: "a.csv", accounts: CHART });
    await owner.mutation(api.imports.page, { runId, journals: [csvJournal(1, "2026-08-04", 10_000)] });
    await owner.action(api.imports.complete, { runId });

    await t.run((ctx) =>
      ctx.db.insert("xeroConnections", {
        orgId, tenantId: "t1", tenantName: "Demo Company (Global)", accessTokenEnc: new ArrayBuffer(1), refreshTokenEnc: new ArrayBuffer(1),
        expiresAt: 0, lastJournalNumber: 0, journalsStored: 0, status: "connected", connectedAt: Date.now(),
      }),
    );
    await expect(owner.action(api.imports.start, { source: "csv", label: "b.csv", accounts: CHART })).rejects.toThrow(/Disconnect it/);

    expect(await t.mutation(internal.sync.claimForXero, { orgId })).toBe(true);
    expect(await t.mutation(internal.sync.claimForXero, { orgId })).toBe(false);
    while (await t.mutation(internal.sync.clearBatch, { orgId, accounts: true }));
    expect(await t.run((ctx) => ctx.db.query("accounts").collect())).toHaveLength(0);
    expect((await owner.query(api.orgs.current, {}))?.org).toMatchObject({ source: "xero", asOf: null });
  });

  it("explains an unreachable engine and lets the report step be retried", async () => {
    const { owner } = await setup();
    const runId = await owner.action(api.imports.start, { source: "csv", label: "a.csv", accounts: CHART });
    await owner.mutation(api.imports.page, { runId, journals: [csvJournal(1, "2026-08-04", 10_000)] });
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
    await expect(owner.action(api.imports.complete, { runId })).rejects.toThrow(/finance engine/);
    expect((await owner.query(api.orgs.current, {}))?.lastSync).toMatchObject({ status: "failed", phase: "reports" });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({}), { status: 200 }));
    await owner.action(api.imports.complete, { runId });
    expect((await owner.query(api.orgs.current, {}))?.lastSync?.status).toBe("done");
  });
});

describe("Xero without journal access", () => {
  const ACCOUNTS = [
    { xero_account_id: "bank", code: "090", name: "Bank", type: "BANK", account_class: "ASSET", system_account: "", status: "ACTIVE" },
    { xero_account_id: "sales", code: "200", name: "Sales", type: "REVENUE", account_class: "REVENUE", system_account: "", status: "ACTIVE" },
    { xero_account_id: "re", code: "960", name: "Retained earnings", type: "EQUITY", account_class: "EQUITY", system_account: "RETAINEDEARNINGS", status: "ACTIVE" },
  ];
  const REPORTS_SCOPES = ["openid", "offline_access", "accounting.settings.read", "accounting.reports.trialbalance.read"];

  type Call = { path: string; body: Record<string, unknown> };

  /** A fake engine: every month bank +€1 and sales −€1; the opening month brings €10 of capital. */
  function stubEngine(overrides: Partial<Record<string, (body: Record<string, unknown>) => unknown>> = {}) {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      const body = JSON.parse(String(init?.body ?? "{}"));
      calls.push({ path, body });
      const handlers: Record<string, (b: Record<string, unknown>) => unknown> = {
        "/xero/accounts": () => ({ accounts: ACCOUNTS }),
        "/xero/trial-balances": (b) => ({
          periods: (b.periods as string[]).map((period) => ({
            period,
            lines:
              period === b.opening_period
                ? [{ xero_account_id: "bank", net_cents: 1_000 }, { xero_account_id: "re", net_cents: -1_000 }]
                : [{ xero_account_id: "bank", net_cents: 100 }, { xero_account_id: "sales", net_cents: -100 }],
          })),
          syntheticAccounts: [],
        }),
        "/xero/daily-cash": () => ({ days: [{ date: "2026-10-02", net_cents: 100 }] }),
        "/xero/open-items": () => ({ ageing: {} }),
        "/reports/build": () => ({ asOf: "2026-09", fyStart: "2026-01" }),
        "/reconcile": () => ({ status: "match" }),
        "/xero/journals": () => ({ journals: [journal(1, "2026-10-05", [["bank", 700], ["sales", -700]])], nextOffset: 1, fullPage: false }),
        "/xero/journal-check": () => ({ ok: true }),
        ...overrides,
      };
      const handler = handlers[path];
      return handler ? new Response(JSON.stringify(handler(body)), { status: 200 }) : new Response("{}", { status: 404 });
    });
    return calls;
  }

  async function connect(scopes: string[]) {
    const ctx = await setup();
    const { encrypt } = await import("./lib/crypto");
    await ctx.t.mutation(internal.xero.saveConnection, {
      orgId: ctx.orgId,
      tenantId: "tenant-1",
      tenantName: "Demo Company (Global)",
      accessTokenEnc: await encrypt("access"),
      refreshTokenEnc: await encrypt("refresh"),
      expiresAt: Date.now() + 30 * 60_000,
      scopes,
    });
    return ctx;
  }

  const settle = (t: ReturnType<typeof convexTest>) => t.finishAllScheduledFunctions(vi.runAllTimers);
  const balances = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("accountBalances").collect());
  const runs = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("syncRuns").collect());

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("reads two years of month-end trial balances on the first sync, six months a step", async () => {
    const calls = stubEngine();
    const { t, owner } = await connect(REPORTS_SCOPES);
    await settle(t);

    const tb = calls.filter((c) => c.path === "/xero/trial-balances");
    expect(tb).toHaveLength(5); // 26 months: Sep 2024 (opening) to Oct 2026
    expect(tb[0].body.periods).toEqual(["2024-09", "2024-10", "2024-11", "2024-12", "2025-01", "2025-02"]);
    expect(tb[0].body.opening_period).toBe("2024-09");
    expect(tb[0].body.retained_earnings_id).toBe("re");
    expect(tb.slice(1).every((c) => c.body.opening_period === null)).toBe(true);
    expect(calls.map((c) => c.path)).not.toContain("/xero/journals");

    const rows = await balances(t);
    expect(rows.filter((r) => r.period === "2024-09").map((r) => Number(r.netCents)).sort()).toEqual([-1_000, 1_000]);
    expect(rows.filter((r) => r.xeroAccountId === "sales")).toHaveLength(25);
    const current = await owner.query(api.orgs.current, {});
    expect(current?.connection).toMatchObject({ mode: "reports", historyFrom: "2024-09", balancesThrough: "2026-10" });
    expect(current?.lastSync).toMatchObject({ status: "done", mode: "reports", monthsStored: 26 });
    expect((await t.run((ctx) => ctx.db.query("dailyCash").collect())).map((d) => d.date)).toEqual(["2026-10-02"]);
  });

  it("rereads only the last three months each night, replacing them rather than adding", async () => {
    const calls = stubEngine();
    const { t, orgId } = await connect(REPORTS_SCOPES);
    await settle(t);
    calls.length = 0;

    await t.mutation(internal.sync.enqueue, { orgId, trigger: "Nightly" });
    await settle(t);
    const tb = calls.filter((c) => c.path === "/xero/trial-balances");
    expect(tb).toHaveLength(1);
    expect(tb[0].body).toMatchObject({ periods: ["2026-08", "2026-09", "2026-10"], opening_period: null });
    const august = (await balances(t)).filter((r) => r.period === "2026-08" && r.xeroAccountId === "bank");
    expect(august.map((r) => Number(r.netCents))).toEqual([100]);
  });

  it("rebuilds the whole history when the check against Xero finds a difference", async () => {
    stubEngine();
    const { t, orgId } = await connect(REPORTS_SCOPES);
    await settle(t);
    stubEngine({ "/reconcile": () => ({ status: "mismatch", differences: [] }) });
    await t.mutation(internal.sync.enqueue, { orgId, trigger: "Nightly" });
    await settle(t);
    const all = await runs(t);
    const refresh = all.find((r) => r.trigger === "Full refresh");
    expect(refresh).toMatchObject({ full: true, status: "needsReview" }); // still differs, and doesn't loop
    expect(all.filter((r) => r.trigger === "Full refresh")).toHaveLength(1);
  });

  it("switches to every journal line when Xero grants journal access, clearing the trial balance figures", async () => {
    stubEngine();
    const { t, orgId, owner } = await connect(REPORTS_SCOPES);
    await settle(t);
    const calls = stubEngine();
    await t.run(async (ctx) => {
      const c = await ctx.db.query("xeroConnections").first();
      await ctx.db.patch(c!._id, { scopes: [...REPORTS_SCOPES, "accounting.journals.read"] });
    });
    await t.mutation(internal.sync.enqueue, { orgId, trigger: "Manual" });
    await settle(t);
    expect(calls.map((c) => c.path)).toContain("/xero/journals");
    expect(calls.map((c) => c.path)).not.toContain("/xero/trial-balances");
    const rows = await balances(t);
    expect(rows.map((r) => [r.xeroAccountId, r.period, Number(r.netCents)]).sort()).toEqual([
      ["bank", "2026-10", 700],
      ["sales", "2026-10", -700],
    ]);
    expect((await owner.query(api.orgs.current, {}))?.connection?.mode).toBe("journals");
    const events = await owner.query(api.audit.list, { paginationOpts: { numItems: 20, cursor: null } });
    expect(events.page.map((e: { action: string }) => e.action)).toContain("gained journal access to");
  });

  it("drill-down reads the documents behind a figure from Xero once, then from the cache", async () => {
    stubEngine();
    const { t, owner } = await connect(REPORTS_SCOPES);
    await settle(t);
    const calls = stubEngine({
      "/xero/account-activity": (b) => ({
        lines: [{ date: "2026-09-04", source: "Invoice", reference: "INV-1", contact: "Seaview Hotel", description: "", net_cents: -60 }],
        explained_cents: -60,
        unexplained_cents: (b.movement_cents as number) + 60,
      }),
    });
    const first = await owner.action(api.ledger.activity, { xeroAccountId: "sales", period: "2026-09" });
    const second = await owner.action(api.ledger.activity, { xeroAccountId: "sales", period: "2026-09" });
    expect(first).toMatchObject({ movementCents: -100, explained_cents: -60, unexplained_cents: -40 });
    expect(second?.lines).toEqual(first?.lines);
    expect(calls.filter((c) => c.path === "/xero/account-activity")).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ account_id: "sales", period: "2026-09", movement_cents: -100 });
  });
});
