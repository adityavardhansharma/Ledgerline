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

  it("accepts Clerk's compact session token, which carries the organisation as { o: { id, rol } }", async () => {
    const t = convexTest(schema, modules);
    const compact = t.withIdentity({ subject: "user_aoife", o: { id: "org_kestrel", rol: "admin", slg: "kestrel" } } as never);
    const orgId = await compact.mutation(api.orgs.ensure, {});
    expect(orgId).not.toBeNull();
    const current = await compact.query(api.orgs.current, {});
    expect(current).toMatchObject({ role: "owner", org: { name: "Your organisation" } });
    // The full template token later fills in the real name.
    await t.withIdentity(OWNER as never).mutation(api.orgs.ensure, {});
    expect((await compact.query(api.orgs.current, {}))?.org.name).toBe("Kestrel Joinery Ltd");
  });

  it("lets each person set up two companies on the Free plan", async () => {
    const { t } = await setup();
    const second = t.withIdentity({ ...OWNER, org_id: "org_second", org_name: "Second Ltd" } as never);
    const third = t.withIdentity({ ...OWNER, org_id: "org_third", org_name: "Third Ltd" } as never);
    expect(await second.mutation(api.orgs.ensure, {})).not.toBeNull();
    expect(await third.query(api.billing.newCompany, {})).toMatchObject({ blocked: true, limit: 2, names: ["Kestrel Joinery Ltd", "Second Ltd"] });
    await expect(third.mutation(api.orgs.ensure, {})).rejects.toThrow();
    expect(await third.query(api.orgs.current, {})).toBeNull();
    // Someone else's companies don't count against them.
    expect(await t.withIdentity(STRANGER as never).mutation(api.orgs.ensure, {})).not.toBeNull();
    expect((await second.query(api.billing.overview, {}))?.companies).toMatchObject({ used: 2, limit: 2, mine: true });
  });

  it("only owners change settings", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.orgs.updateSettings, { fyStartMonth: 4 });
    expect((await owner.query(api.orgs.current, {}))?.org.fyStartMonth).toBe(4);
    await expect(t.withIdentity(ACCOUNTANT as never).mutation(api.orgs.updateSettings, { fyStartMonth: 1 })).rejects.toThrow(/owner/);
  });

  it("makes members editors and any role it doesn't know read-only", async () => {
    const { t } = await setup();
    const as = (role: string) => t.withIdentity({ ...OWNER, subject: `user_${role}`, org_role: `org:${role}` } as never);
    expect((await as("member").query(api.orgs.current, {}))?.role).toBe("editor");
    expect((await as("billing_manager").query(api.orgs.current, {}))?.role).toBe("accountant");
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

    // The scenario list reads one small summary per scenario, not the whole run.
    const summaries = await t.run((ctx) => ctx.db.query("forecastSummaries").collect());
    expect(summaries).toHaveLength(1);
    const [listed] = await owner.query(api.scenarios.list, {});
    expect(listed.summary).toEqual({ runwayMonths: 14, cashOutPeriod: "2027-12", endCash: 0, lowestCash: 0, revenueFirst12: 0, ebitdaFirst12: 0 });
    // New actuals make the summary stale until the next run.
    await t.mutation(internal.reports.storeSnapshot, { orgId, kind: "statements", bumpVersion: true, asOf: "2026-10", data: {} });
    expect((await owner.query(api.scenarios.list, {}))[0].summary).toBeNull();
  });
});

describe("Connecting Xero", () => {
  const begin = async (t: ReturnType<typeof convexTest>, orgId: unknown, state: string) =>
    t.run((ctx) => ctx.db.insert("oauthStates", { orgId: orgId as never, userId: OWNER.subject, state, verifier: "v", redirectUri: "https://convex.test/xero/callback", createdAt: Date.now() }));

  it("hands the code to the app instead of finishing the connection itself", async () => {
    const t = convexTest(schema, modules);
    const res = await t.fetch("/xero/callback?code=abc&state=xyz", { method: "GET", redirect: "manual" });
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get("location") ?? "");
    expect(to.pathname).toBe("/connect/xero");
    expect(to.searchParams.get("code")).toBe("abc");
    expect(to.searchParams.get("state")).toBe("xyz");
  });

  it("only lets the person who started the flow finish it, once", async () => {
    // Connecting schedules the first sync; keep it from running into later tests.
    vi.useFakeTimers();
    const { t, owner, orgId } = await setup();
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ tokens: { access_token: "a", refresh_token: "r", expires_at: 1 }, scopes: [], connections: [{ tenant_id: "tenant-1", tenant_name: "Kestrel" }] }), { status: 200 });
    });
    const stranger = t.withIdentity(STRANGER as never);
    await stranger.mutation(api.orgs.ensure, {});
    await begin(t, orgId, "s1");
    // Someone in another company, landing on a link made in this one, can't finish it, and the state is spent.
    expect(await stranger.action(api.xero.completeConnect, { code: "c", state: "s1" })).toEqual({ ok: false, reason: "wrong-account" });
    expect(await owner.action(api.xero.completeConnect, { code: "c", state: "s1" })).toEqual({ ok: false, reason: "expired" });
    // Nor can another owner of the same company.
    await begin(t, orgId, "s2");
    expect(await t.withIdentity({ ...OWNER, subject: "user_other_owner" } as never).action(api.xero.completeConnect, { code: "c", state: "s2" })).toEqual({ ok: false, reason: "wrong-account" });
    expect(calls).toHaveLength(0);
    await begin(t, orgId, "s3");
    expect(await owner.action(api.xero.completeConnect, { code: "c", state: "s3" })).toEqual({ ok: true });
    expect(await owner.action(api.xero.completeConnect, { code: "c", state: "s3" })).toEqual({ ok: false, reason: "expired" });
    expect(calls.filter((c) => c.endsWith("/xero/token"))).toHaveLength(1);
    vi.useRealTimers();
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

describe("stuck syncs", () => {
  it("fails a run that has gone quiet, so the next sync can start", async () => {
    const { t, orgId } = await setup();
    const long = Date.now() - 20 * 60 * 1000;
    const [stuck, fresh] = await t.run(async (ctx) => [
      await ctx.db.insert("syncRuns", { orgId, trigger: "Nightly", phase: "journals", status: "running", pagesDone: 3, journalsStored: 300, attempts: 0, startedAt: long, touchedAt: long }),
      await ctx.db.insert("syncRuns", { orgId, trigger: "Manual", phase: "journals", status: "running", pagesDone: 1, journalsStored: 100, attempts: 0, startedAt: long, touchedAt: Date.now() }),
    ]);
    await t.mutation(internal.sync.recoverStuck, {});
    const [a, b] = await t.run(async (ctx) => [await ctx.db.get(stuck), await ctx.db.get(fresh)]);
    expect(a).toMatchObject({ status: "failed" });
    expect(a?.error).toMatch(/stopped responding/);
    expect(b).toMatchObject({ status: "running" });
  });

  it("finishes the run when reading the tokens throws, instead of leaving it running", async () => {
    vi.useFakeTimers();
    const { t, orgId } = await setup();
    const runId = await t.run(async (ctx) => {
      await ctx.db.insert("xeroConnections", {
        orgId,
        tenantId: "tenant-1",
        tenantName: "Kestrel",
        accessTokenEnc: new Uint8Array([1, 2, 3]).buffer,
        refreshTokenEnc: new Uint8Array([1, 2, 3]).buffer,
        expiresAt: Date.now(),
        scopes: [],
        status: "connected",
        lastJournalNumber: 0,
        journalsStored: 0,
        connectedAt: Date.now(),
      });
      return ctx.db.insert("syncRuns", { orgId, trigger: "Manual", phase: "accounts", status: "queued", pagesDone: 0, journalsStored: 0, attempts: 0, startedAt: Date.now() });
    });
    await t.action(internal.sync.runStep, { runId });
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "backingOff", attempts: 1 });
    vi.useRealTimers();
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
    const orgId = (await owner.query(api.orgs.current, {}))!.org.id;
    await t.run((ctx) => ctx.db.insert("boardNotes", { orgId, period: "2026-08", text: "Won the Seaview contract", updatedBy: "Aoife Byrne", updatedAt: Date.now() }));

    const second = await owner.action(api.imports.start, { source: "sample", label: "Kestrel Joinery Ltd", accounts: CHART.slice(0, 1) });
    expect(await t.run((ctx) => ctx.db.query("ledgerLines").collect())).toHaveLength(0);
    // What people wrote stays when the same company's figures are replaced.
    expect(await t.run((ctx) => ctx.db.query("boardNotes").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("accounts").collect())).toHaveLength(1);
    await expect(owner.mutation(api.imports.page, { runId: second, journals: [csvJournal(1, "2026-08-04", 10_000)] })).rejects.toThrow(/isn't in the chart/);
    await expect(owner.mutation(api.imports.page, { runId: second, journals: [{ ...csvJournal(2, "2026-08-04", 1), xero_journal_id: "x-2" }] })).rejects.toThrow(/from a file/);
    await expect(t.withIdentity(ACCOUNTANT as never).action(api.imports.start, { source: "csv", label: "x", accounts: CHART })).rejects.toThrow(/Accountants/);
    await expect(owner.action(api.imports.start, { source: "csv", label: "x", accounts: CHART })).rejects.toThrow(/already running/);
    // Claiming is one transaction: a second import can't slip in while the first clears the old figures.
    await expect(owner.mutation(internal.imports.claim, { source: "csv" })).rejects.toThrow(/already running/);
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

  it("switching to a different Xero organisation replaces the figures instead of refusing", async () => {
    stubEngine();
    const { t, orgId, owner } = await connect(REPORTS_SCOPES);
    await settle(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("accountBalances", { orgId, xeroAccountId: "old-only", period: "2026-01", netCents: 5n });
    });
    const { encrypt } = await import("./lib/crypto");
    const calls = stubEngine();
    await t.mutation(internal.xero.saveConnection, {
      orgId,
      tenantId: "tenant-demo",
      tenantName: "Demo Company (Global)",
      accessTokenEnc: await encrypt("access2"),
      refreshTokenEnc: await encrypt("refresh2"),
      expiresAt: Date.now() + 30 * 60_000,
      scopes: REPORTS_SCOPES,
    });
    await settle(t);
    const rows = await balances(t);
    expect(rows.some((r) => r.xeroAccountId === "old-only")).toBe(false);
    expect(calls.filter((c) => c.path === "/xero/trial-balances")[0].body.opening_period).toBe("2024-09");
    const current = await owner.query(api.orgs.current, {});
    expect(current?.connection).toMatchObject({ tenantName: "Demo Company (Global)", mode: "reports" });
    expect(current?.lastSync).toMatchObject({ trigger: "Switched organisation", status: "done" });
    const events = await owner.query(api.audit.list, { paginationOpts: { numItems: 20, cursor: null } });
    expect(events.page.map((e: { action: string }) => e.action)).toContain("switched to Xero organisation");
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

describe("board commentary", () => {
  const CHART = [
    { xeroAccountId: "csv:090", code: "090", name: "Bank", type: "BANK", accountClass: "ASSET", systemAccount: "", status: "ACTIVE" },
    { xeroAccountId: "csv:200", code: "200", name: "Sales", type: "REVENUE", accountClass: "REVENUE", systemAccount: "", status: "ACTIVE" },
  ];
  const sale = (n: number, date: string, cents: number, contact: string) => ({
    ...journal(n, date, [["csv:090", cents], ["csv:200", -cents]]),
    xero_journal_id: `csv:${n}`,
    lines: [
      { xero_account_id: "csv:090", net_cents: cents, description: "", contact },
      { xero_account_id: "csv:200", net_cents: -cents, description: "", contact },
    ],
  });
  const cite = (text: string, source: string, fact: string) => ({ text, source, fact });
  const SECTIONS = {
    headline: [["Revenue was ", cite("€350", "Revenue · Sales", "revenue")]],
    performance: [["Sales rose."]],
    cash: [["Cash is ", cite("€600", "Cash · Bank", "cash")]],
    outlook: [],
    risks: [{ level: "amber", title: "One customer", detail: ["Most sales come from one customer."] }],
    decisions: [],
    questions: [],
  };

  async function imported() {
    const ctx = await setup();
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.endsWith("/reports/build")) return new Response(JSON.stringify({ asOf: "2026-09", fyStart: "2026-01" }), { status: 200 });
      if (url.endsWith("/commentary/draft")) {
        bodies.push(body);
        const sections = body.section ? { [body.section]: [["Redrafted ", cite("€600", "Cash · Bank", "cash")]] } : SECTIONS;
        return new Response(JSON.stringify({ sections, facts: [{ id: "revenue", label: "Revenue", value: "€350", source: "Sales", group: "performance" }], signals: [] }), { status: 200 });
      }
      if (url.endsWith("/commentary/ask")) {
        bodies.push(body);
        return new Response(JSON.stringify({ answer: [["Because of ", cite("€350", "Revenue · Sales", "revenue")]] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    });
    const runId = await ctx.owner.action(api.imports.start, { source: "sample", label: "Kestrel Joinery Ltd", accounts: CHART });
    await ctx.owner.mutation(api.imports.page, {
      runId,
      journals: [sale(1, "2026-08-04", 10_000, "Glenmore"), sale(2, "2026-09-04", 25_000, "Seaview Hotel"), sale(3, "2026-09-12", 10_000, "Glenmore")],
    });
    await ctx.owner.action(api.imports.complete, { runId });
    return { ...ctx, bodies };
  }

  it("drafts from the ledger with sales by customer and the month's notes, then redrafts one section", async () => {
    const { owner, bodies } = await imported();
    await owner.mutation(api.commentary.saveNotes, { text: "Won the Seaview Hotel refurbishment." });
    await owner.action(api.commentary.draft, { tone: "investor" });
    const body = bodies[0] as { as_of: string; notes: string; tone: string; balances: unknown[]; customers: { month: { contact: string; value: number }[]; prior: string[] } };
    expect(body).toMatchObject({ as_of: "2026-09", notes: "Won the Seaview Hotel refurbishment.", tone: "investor" });
    expect(body.balances.length).toBeGreaterThan(0);
    expect(body.customers.month).toEqual(expect.arrayContaining([{ contact: "Seaview Hotel", value: 25_000 }, { contact: "Glenmore", value: 10_000 }]));
    expect(body.customers.prior).toEqual(["Glenmore"]);

    const first = await owner.query(api.commentary.latest, {});
    expect(first).toMatchObject({ status: "draft", tone: "investor", createdBy: "Aoife Byrne" });
    await owner.action(api.commentary.draft, { section: "cash" });
    expect(bodies[1]).toMatchObject({ section: "cash", tone: "investor" });
    const second = await owner.query(api.commentary.latest, {});
    expect(second?.sections?.cash?.[0]?.[0]).toBe("Redrafted ");
    expect(second?.sections?.headline).toEqual(first?.sections?.headline);
    expect(await owner.query(api.commentary.history, {})).toHaveLength(2);
  });

  it("lets people reword a section but never type or change a figure", async () => {
    const { owner } = await imported();
    await owner.action(api.commentary.draft, {});
    const draft = (await owner.query(api.commentary.latest, {}))!;
    const id = draft.id;
    await expect(owner.mutation(api.commentary.editSection, { id, section: "performance", value: [["Sales rose 12%."]] })).rejects.toThrow(/Figures can't be typed/);
    await expect(
      owner.mutation(api.commentary.editSection, { id, section: "headline", value: [["Revenue was ", { text: "€999", source: "Revenue · Sales", fact: "revenue" }]] }),
    ).rejects.toThrow(/citation was changed/);
    await owner.mutation(api.commentary.editSection, { id, section: "headline", value: [["Sales came to ", cite("€350", "Revenue · Sales", "revenue")]] });
    const edited = (await owner.query(api.commentary.latest, {}))!;
    expect(edited).toMatchObject({ editedBy: "Aoife Byrne", status: "draft" });
    expect(edited.sections?.headline?.[0]?.[0]).toBe("Sales came to ");

    await owner.mutation(api.commentary.restore, { id });
    expect((await owner.query(api.commentary.latest, {}))?.sections?.headline?.[0]?.[0]).toBe("Revenue was ");
    await owner.mutation(api.commentary.accept, { id: (await owner.query(api.commentary.latest, {}))!.id });
    expect((await owner.query(api.commentary.latest, {}))?.status).toBe("accepted");
  });

  it("answers questions with the conversation so far", async () => {
    const { owner, bodies } = await imported();
    const result = await owner.action(api.commentary.ask, { question: "Why did revenue rise?", history: [{ question: "Hi", answer: "Hello" }] });
    expect(result.answer[0][0]).toBe("Because of ");
    expect(bodies[0]).toMatchObject({ question: "Why did revenue rise?", history: [{ question: "Hi", answer: "Hello" }] });
    await expect(owner.action(api.commentary.ask, { question: "  " })).rejects.toThrow(/Ask a question/);
  });

  it("keeps the first base-case forecast after a month closes as that month's plan", async () => {
    const { t, owner, orgId } = await imported();
    const base = (await owner.query(api.scenarios.list, {}))!.find((s) => s.isBase)!;
    const months = [{ period: "2026-10", revenue: 30_000, ebitda: 5_000, netProfit: 4_000, cash: 90_000 }];
    const store = (revenue: number) =>
      t.mutation(internal.forecast.store, { orgId, scenarioId: base.id, inputsHash: `h${revenue}`, actualsVersion: 1, data: { months: [{ ...months[0], revenue }] } });
    await store(30_000);
    await store(99_000);
    const plans = await t.run((ctx) => ctx.db.query("plans").collect());
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ madeAt: "2026-09", months: [{ period: "2026-10", revenue: 30_000 }] });
  });
});

describe("AI actions and search", () => {
  const CHART = [
    { xeroAccountId: "csv:090", code: "090", name: "Bank", type: "BANK", accountClass: "ASSET", systemAccount: "", status: "ACTIVE" },
    { xeroAccountId: "csv:610", code: "610", name: "Trade debtors", type: "CURRENT", accountClass: "ASSET", systemAccount: "DEBTORS", status: "ACTIVE" },
    { xeroAccountId: "csv:200", code: "200", name: "Sales", type: "REVENUE", accountClass: "REVENUE", systemAccount: "", status: "ACTIVE" },
    { xeroAccountId: "csv:400", code: "400", name: "Marketing", type: "OVERHEADS", accountClass: "EXPENSE", systemAccount: "", status: "ACTIVE" },
  ];
  const line = (account: string, cents: number, contact = "") => ({ xero_account_id: account, net_cents: cents, description: "", ...(contact ? { contact } : {}) });
  const entry = (n: number, date: string, source: string, reference: string, lines: ReturnType<typeof line>[]) => ({ xero_journal_id: `csv:${n}`, journal_number: n, date, source_type: source, reference, lines });

  async function books() {
    const ctx = await setup();
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url, body });
      if (url.endsWith("/reports/build")) return new Response(JSON.stringify({ asOf: "2026-09", fyStart: "2026-01" }), { status: 200 });
      if (url.endsWith("/actions/explain-figure")) return new Response(JSON.stringify({ paragraphs: [["Sales were ", { text: "€350", source: "Sales", fact: "value" }]] }), { status: 200 });
      if (url.endsWith("/actions/reminder")) return new Response(JSON.stringify({ subject: ["Invoices due"], body: [["Please pay."]] }), { status: 200 });
      if (url.endsWith("/search/parse")) return new Response(JSON.stringify({ accounts: [], contact: "Seaview Hotel", words: "", dateFrom: "2026-09-01", dateTo: "", minCents: 10_000, maxCents: null, side: "any" }), { status: 200 });
      if (url.endsWith("/actions/parse-scenario")) return new Response(JSON.stringify({ detail: "number not stated" }), { status: 422 });
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
    });
    const runId = await ctx.owner.action(api.imports.start, { source: "sample", label: "Kestrel", accounts: CHART });
    await ctx.owner.mutation(api.imports.page, {
      runId,
      journals: [
        entry(1, "2026-08-04", "ACCREC", "INV-1", [line("csv:610", 20_000, "Glenmore"), line("csv:200", -20_000, "Glenmore")]),
        entry(2, "2026-08-20", "ACCRECPAYMENT", "INV-1", [line("csv:090", 20_000, "Glenmore"), line("csv:610", -20_000, "Glenmore")]),
        entry(3, "2026-09-04", "ACCREC", "INV-2", [line("csv:610", 25_000, "Seaview Hotel"), line("csv:200", -25_000, "Seaview Hotel")]),
        entry(4, "2026-09-10", "CASHPAID", "Card", [line("csv:400", 5_000), line("csv:090", -5_000)]),
      ],
    });
    await ctx.owner.action(api.imports.complete, { runId });
    return { ...ctx, calls };
  }

  it("explains a figure once per version of the figures and logs each model call", async () => {
    const { t, owner, calls } = await books();
    const first = await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" });
    const again = await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" });
    expect(again).toEqual(first);
    const sent = calls.filter((c) => c.url.endsWith("/actions/explain-figure"));
    expect(sent).toHaveLength(1);
    // Income is shown positive, with its lines in the same sign.
    expect(sent[0].body).toMatchObject({ account: "Sales", kind: "income", value_cents: 25_000, previous_cents: 20_000 });
    expect((sent[0].body.lines as { cents: number; contact: string }[])[0]).toMatchObject({ cents: 25_000, contact: "Seaview Hotel" });
    const usage = await t.run((ctx) => ctx.db.query("aiUsage").collect());
    expect(usage.map((u) => u.action)).toEqual(["explainFigure"]);
  });

  it("keeps separate monthly allowances, and shows the last answer once AI actions run out", async () => {
    const { t, owner, orgId, calls } = await books();
    const first = await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 19; i++) await ctx.db.insert("aiUsage", { orgId, action: "digest", by: "Aoife Byrne", at: Date.now() });
      // Last month's calls don't count.
      await ctx.db.insert("aiUsage", { orgId, action: "chat", by: "Aoife Byrne", at: Date.UTC(2020, 0, 1) });
    });
    // A kept answer for the same figures is still free.
    expect(await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" })).toEqual(first);
    // New figures would need a model call: the last answer comes back with the paused message instead.
    await t.run((ctx) => ctx.db.patch(orgId, { actualsVersion: 99 }));
    const paused = await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" }).catch((err) => err);
    expect(paused.data).toMatchObject({ code: "limit", meter: "actions", last: first });
    expect(paused.data.message).toMatch(/20 AI actions .* paused until/);
    // A question never asked before has nothing to show.
    const fresh = await owner.action(api.aiActions.explainFigure, { accountId: "csv:400", period: "2026-09" }).catch((err) => err);
    expect(fresh.data).toMatchObject({ code: "limit" });
    expect(fresh.data.last).toBeUndefined();
    expect(calls.filter((c) => c.url.endsWith("/actions/explain-figure"))).toHaveLength(1);
    // Search and chat have their own allowances.
    await owner.action(api.search.parse, { text: "Seaview over 100 since September" });
    const billing = await owner.query(api.billing.overview, {});
    expect(billing?.meters).toEqual([
      { meter: "actions", used: 20, limit: 20 },
      { meter: "searches", used: 1, limit: 100 },
      { meter: "chats", used: 0, limit: 50 },
    ]);
  });

  it("raises a company's allowances with a voucher, once per company", async () => {
    const { t, owner, orgId, calls } = await books();
    await t.mutation(internal.billing.setVoucher, { code: "examplecode", limits: { actions: 40, chats: 80 } });
    await expect(owner.mutation(api.billing.redeem, { code: "NOPE" })).rejects.toThrow(/isn't valid/);
    await expect(t.withIdentity(ACCOUNTANT as never).mutation(api.billing.redeem, { code: "EXAMPLECODE" })).rejects.toThrow(/Accountants/);
    expect(await owner.mutation(api.billing.redeem, { code: " examplecode " })).toMatchObject({ code: "EXAMPLECODE", limits: { actions: 40, chats: 80 } });
    await expect(owner.mutation(api.billing.redeem, { code: "EXAMPLECODE" })).rejects.toThrow(/already applied/);
    const billing = await owner.query(api.billing.overview, {});
    expect(billing?.vouchers).toEqual(["EXAMPLECODE"]);
    expect(billing?.meters).toEqual([
      { meter: "actions", used: 0, limit: 40 },
      { meter: "searches", used: 0, limit: 100 },
      { meter: "chats", used: 0, limit: 80 },
    ]);
    // Past the Free plan's 20, still allowed; at 40, paused with the voucher's figure.
    await t.run(async (ctx) => {
      for (let i = 0; i < 39; i++) await ctx.db.insert("aiUsage", { orgId, action: "digest", by: "Aoife Byrne", at: Date.now() });
    });
    await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" });
    expect(calls.filter((c) => c.url.endsWith("/actions/explain-figure"))).toHaveLength(1);
    const paused = await owner.action(api.aiActions.explainFigure, { accountId: "csv:400", period: "2026-09" }).catch((err) => err);
    expect(paused.data.message).toMatch(/40 AI actions/);
    // Turning the voucher off returns the company to the Free plan.
    await t.mutation(internal.billing.setVoucher, { code: "EXAMPLECODE", limits: { actions: 40, chats: 80 }, active: false });
    expect((await owner.query(api.billing.overview, {}))?.meters[0]).toMatchObject({ limit: 20 });
  });

  it("pauses search and chat at their own limits, answering in the chat itself", async () => {
    const { t, owner, orgId, calls } = await books();
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("aiUsage", { orgId, action: "search", by: "Aoife Byrne", at: Date.now() });
      for (let i = 0; i < 50; i++) await ctx.db.insert("aiUsage", { orgId, action: "chat", by: "Aoife Byrne", at: Date.now() });
    });
    await expect(owner.action(api.search.parse, { text: "Seaview" })).rejects.toThrow();
    const turn = await owner.action(api.chat.turn, { text: "How did September go?" });
    expect(turn.answer).toMatch(/50 AI chats .* New answers are paused until/);
    const messages = await t.run((ctx) => ctx.db.query("chatMessages").collect());
    expect(messages.map((m) => [m.role, m.status, m.paused ?? false])).toEqual([
      ["user", "done", false],
      ["assistant", "done", true],
    ]);
    expect(calls.some((c) => c.url.endsWith("/search/parse") || c.url.includes("/chat"))).toBe(false);
    // AI actions still work.
    await owner.action(api.aiActions.explainFigure, { accountId: "csv:200", period: "2026-09" });
  });

  it("works out unpaid invoices from imported journals and drafts a reminder from them", async () => {
    const { t, owner, orgId, calls } = await books();
    const ageing = (await owner.query(api.reports.ageing, {})) as { receivableTop: { contact: string; value: number }[]; receivable: { value: number }[] };
    expect(ageing.receivableTop).toEqual([{ contact: "Seaview Hotel", value: 25_000 }]);
    expect(ageing.receivable.reduce((s, b) => s + b.value, 0)).toBe(25_000);
    // Worked out once when the figures were built, so the overview doesn't reread the ledger on every view.
    const stored = await t.run((ctx) => ctx.db.query("reportSnapshots").withIndex("by_org_kind", (q) => q.eq("orgId", orgId).eq("kind", "ageing")).collect());
    expect(stored).toHaveLength(1);
    expect(stored[0].data).toEqual(ageing);
    // A company imported before those snapshots existed still gets its ageing, worked out on the spot.
    await t.run(async (ctx) => {
      for (const row of stored) await ctx.db.delete(row._id);
    });
    expect(await owner.query(api.reports.ageing, {})).toEqual(ageing);
    await owner.action(api.aiActions.reminder, { contact: "Seaview Hotel" });
    const body = calls.find((c) => c.url.endsWith("/actions/reminder"))!.body;
    expect(body).toMatchObject({ contact: "Seaview Hotel", as_of: "2026-09-30", items: [{ number: "INV-2", due_date: "2026-10-04", amount_due_cents: 25_000 }] });
    await expect(owner.action(api.aiActions.reminder, { contact: "Glenmore" })).rejects.toThrow(/no unpaid invoices/);
  });

  it("turns a search into filters and runs it as an exact query", async () => {
    const { owner, calls } = await books();
    const filters = await owner.action(api.search.parse, { text: "Seaview since September over 100" });
    expect(calls.find((c) => c.url.endsWith("/search/parse"))!.body).toMatchObject({ contacts: expect.arrayContaining(["Seaview Hotel", "Glenmore"]) });
    const found = await owner.query(api.search.results, { filters });
    expect(found?.count).toBe(2);
    expect(found?.rows.every((r) => r.contact === "Seaview Hotel")).toBe(true);
    const none = await owner.query(api.search.results, { filters: { ...filters, minCents: 1_000_000 } });
    expect(none?.count).toBe(0);
  });

  it("explains a rejected answer in plain words", async () => {
    const { owner } = await books();
    await expect(owner.action(api.aiActions.parseScenario, { text: "hire two people", startPeriod: "2026-10" })).rejects.toThrow(/didn't pass its checks/);
  });
});

describe("chat", () => {
  const sse = (...events: unknown[]) => new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });

  it("reads the books with tools, streams the answer and keeps the thread private", async () => {
    const { t, owner, orgId } = await setup();
    await t.mutation(internal.reports.storeSnapshot, {
      orgId,
      kind: "statements",
      bumpVersion: true,
      asOf: "2026-09",
      data: { asOf: "2026-09", fyStart: "2026-01", measures: { month: "2026-09", revenue: 24_628_080, cash: 22_878_000, revenueDelta: 0.169 }, series: { periods: [], labels: [] }, pnl: { columns: [], rows: [] }, opexYtd: [] },
    });
    const sent: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      sent.push(body);
      if (sent.length === 1) return sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "company_overview", arguments: "{}" } }] } }] });
      return sse({ choices: [{ delta: { content: "Cash is **€228,780**." } }] }, { choices: [{ delta: { content: " Comfortable." } }] });
    });
    const out = await owner.action(api.chat.turn, { text: "How is cash?", page: "/overview" });
    expect(out).toMatchObject({ answer: "Cash is **€228,780**. Comfortable.", tools: ["company_overview"], statuses: ["Reading the headline figures"] });
    // The second model call saw the tool's result, read as the signed-in organisation.
    const toolMessage = (sent[1].messages as { role: string; content: string }[]).find((m) => m.role === "tool")!;
    expect(JSON.parse(toolMessage.content)).toMatchObject({ company: "Kestrel Joinery Ltd", cash: 228_780, revenueChangePct: 16.9 });
    expect((sent[0].tools as unknown[]).length).toBeGreaterThan(5);

    const threads = await owner.query(api.chat.threads, {});
    expect(threads).toEqual([expect.objectContaining({ title: "How is cash?" })]);
    const messages = await owner.query(api.chat.messages, { threadId: threads[0].id });
    expect(messages.map((m) => [m.role, m.status])).toEqual([["user", "done"], ["assistant", "done"]]);
    // Someone else in the same organisation can't read it.
    const colleague = t.withIdentity({ ...ACCOUNTANT, subject: "user_other_person" } as never);
    expect(await colleague.query(api.chat.messages, { threadId: threads[0].id })).toEqual([]);
    expect(await colleague.query(api.chat.threads, {})).toEqual([]);
  });
});
