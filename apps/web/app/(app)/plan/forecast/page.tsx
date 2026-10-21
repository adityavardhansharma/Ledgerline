"use client";

import {
  AssumptionField,
  Badge,
  Banner,
  Button,
  DataTable,
  FinancialStatement,
  HireRow,
  Input,
  LineChart,
  Panel,
  RunwayGauge,
  Select,
  Tabs,
  TornadoChart,
} from "@ledgerline/ui";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { BranchDialog } from "@/components/app/BranchDialog";
import { useForecast, useScenarios } from "@/components/app/useForecast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { money, periodLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import type { ForecastRun, Snapshot } from "@/lib/types";
import { cashChart } from "@/lib/views";

// Drivers shown as sliders: key, label, unit, scale (stored value × scale = shown value), min, max, step, help.
const DRIVERS: [string, string, string, number, number, number, number, string][] = [
  ["growth", "Revenue growth a month", "%", 100, -5, 10, 0.1, "Compound growth from last month's revenue."],
  ["grossMargin", "Gross margin", "%", 100, 0, 90, 0.5, "Gross profit as a share of revenue."],
  ["overheadGrowth", "Overheads growth a year", "%", 100, -20, 30, 0.5, "Applied to today's monthly overheads."],
  ["debtorDays", "Debtor days", "days", 1, 0, 120, 1, "How long customers take to pay, on average."],
  ["creditorDays", "Creditor days", "days", 1, 0, 120, 1, "How long you take to pay suppliers."],
  ["stockDays", "Stock days", "days", 1, 0, 120, 1, "Stock held, in days of cost of sales."],
];

const uid = () => Math.random().toString(36).slice(2, 10);

function ForecastScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { scenarios, base } = useScenarios();
  const scenarioId = (params.get("scenario") as Id<"scenarios"> | null) ?? base?.id;
  const scenario = useQuery(api.scenarios.get, scenarioId ? { id: scenarioId } : "skip");
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const setOverride = useMutation(api.scenarios.setOverride);
  const setPlanItems = useMutation(api.scenarios.setPlanItems);
  const dependency = useMemo(() => (scenario ? [scenario.overrides, scenario.hires, scenario.oneOffs, scenario.financing, snapshot?.version] : null), [scenario, snapshot?.version]);
  const forecast = useForecast(scenarioId, dependency) as ForecastRun | null | undefined;
  const baseForecast = useForecast(base && base.id !== scenarioId ? base.id : undefined, snapshot?.version) as ForecastRun | null | undefined;
  const [tab, setTab] = useState("assumptions");
  const [statementTab, setStatementTab] = useState("pnl");
  const [branching, setBranching] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const commit = (key: string, shown: number, scale: number) => {
    if (!scenarioId) return;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => void setOverride({ id: scenarioId, key, value: shown / scale }), 400);
  };

  const readOnly = scenario?.isBase ?? false;

  return (
    <AppPage
      active="forecast"
      title="Forecast"
      subtitle={scenario ? (scenario.isBase ? "Base case · drivers taken from your actuals" : `${scenario.name} · branched from ${scenario.parentName}`) : undefined}
      breadcrumbs={["Plan", "Forecast"]}
      needsData
      actions={
        <>
          <Select
            id="scenario-picker"
            value={scenarioId ?? ""}
            onChange={(e) => router.push(`${ROUTES.forecast}?scenario=${e.target.value}`)}
            options={(scenarios ?? []).map((s) => ({ value: s.id, label: s.isBase ? `${s.name} (base)` : s.name }))}
          />
          <Button variant="forecast" icon="branch" disabled={!scenario} onClick={() => setBranching(true)}>
            Branch
          </Button>
        </>
      }
      overlay={
        branching && scenarioId && scenario ? (
          <BranchDialog fromId={scenarioId} fromName={scenario.name} onClose={() => setBranching(false)} onCreated={(id) => { setBranching(false); router.push(`${ROUTES.forecast}?scenario=${id}`); }} />
        ) : null
      }
    >
      {() => {
        if (!snapshot || !scenario) return null;
        const drivers = snapshot.drivers as Record<string, number>;
        const value = (key: string) => scenario.overrides[key] ?? drivers[key];
        const parentValue = (key: string) => scenario.inherited[key] ?? drivers[key];
        const chart = cashChart(snapshot, scenario.isBase ? forecast : baseForecast ?? forecast, scenario.isBase ? null : forecast);
        const ownHires = scenario.own.hires;
        return (
          <div className="ll-grid-2r">
            <Panel title="Drivers" icon="settings" subtitle={readOnly ? "The base case follows your actuals. Branch it to change drivers." : "Changes from the parent scenario are marked"}>
              <Tabs label="Forecast sections" value={tab} onChange={setTab} tabs={[
                { id: "assumptions", label: "Assumptions", count: Object.keys(scenario.own.overrides).length || undefined },
                { id: "hires", label: "Hires", count: scenario.hires.length || undefined },
                { id: "oneoffs", label: "One-offs", count: scenario.oneOffs.length || undefined },
                { id: "financing", label: "Financing", count: scenario.financing.length || undefined },
              ]} />
              <div style={{ marginTop: 4 }}>
                {tab === "assumptions" &&
                  DRIVERS.map(([key, label, unit, scale, min, max, step, help]) => (
                    <fieldset key={`${scenarioId}-${key}`} disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
                      <AssumptionField
                        id={`driver-${key}`}
                        label={label}
                        unit={unit}
                        min={min}
                        max={max}
                        step={step}
                        defaultValue={round(value(key) * scale)}
                        base={scenario.isBase ? undefined : round(parentValue(key) * scale)}
                        help={help}
                        onChange={(v) => commit(key, v, scale)}
                      />
                    </fieldset>
                  ))}
                {tab === "hires" && (
                  <div className="ll-stack" style={{ marginTop: 12 }}>
                    {scenario.hires.map((h) => (
                      <HireRow
                        key={h.id}
                        role={h.role}
                        start={periodLabel(h.startPeriod)}
                        salary={h.salaryCents / 100}
                        count={h.count}
                        monthly={(h.salaryCents / 100 / 12) * 1.1115 * h.count}
                        onRemove={ownHires.some((o) => o.id === h.id) ? () => void setPlanItems({ id: scenario.id, hires: ownHires.filter((o) => o.id !== h.id) }) : undefined}
                      />
                    ))}
                    {readOnly ? <p className="ll-muted">Branch the base case to plan hires.</p> : <AddHire start={snapshot.drivers.startPeriod} onAdd={(h) => void setPlanItems({ id: scenario.id, hires: [...ownHires, { ...h, id: uid() }] })} />}
                  </div>
                )}
                {tab === "oneoffs" && (
                  <PlanList
                    readOnly={readOnly}
                    items={scenario.oneOffs.map((o) => ({ id: o.id, what: o.label, when: periodLabel(o.period), kind: o.kind === "capex" ? "Equipment" : o.kind === "income" ? "Income" : "Expense", amount: o.amountCents }))}
                    onRemove={(id) => void setPlanItems({ id: scenario.id, oneOffs: scenario.own.oneOffs.filter((o) => o.id !== id) })}
                    form={<AddOneOff start={snapshot.drivers.startPeriod} onAdd={(o) => void setPlanItems({ id: scenario.id, oneOffs: [...scenario.own.oneOffs, { ...o, id: uid() }] })} />}
                  />
                )}
                {tab === "financing" && (
                  <PlanList
                    readOnly={readOnly}
                    items={scenario.financing.map((f) => ({ id: f.id, what: f.kind === "loan" ? "Loan drawn" : f.kind === "equity" ? "Equity raised" : "Dividend paid", when: periodLabel(f.period), kind: f.kind, amount: f.kind === "dividend" ? -f.amountCents : f.amountCents }))}
                    onRemove={(id) => void setPlanItems({ id: scenario.id, financing: scenario.own.financing.filter((f) => f.id !== id) })}
                    form={<AddFinancing start={snapshot.drivers.startPeriod} onAdd={(f) => void setPlanItems({ id: scenario.id, financing: [...scenario.own.financing, { ...f, id: uid() }] })} />}
                  />
                )}
              </div>
            </Panel>

            <div className="ll-stack">
              {forecast?.cashOutPeriod ? (
                <Banner tone="negative" title={`Cash runs out in ${periodLabel(forecast.cashOutPeriod)}.`}>
                  Lowest point {money(forecast.lowestCash)} in {forecast.lowestCashPeriod ? periodLabel(forecast.lowestCashPeriod) : "the forecast"}. Add funding under Financing or move costs later.
                </Banner>
              ) : forecast ? (
                <Banner tone="positive" title="Cash stays positive for the whole forecast.">Lowest point {money(forecast.lowestCash)} in {forecast.lowestCashPeriod ? periodLabel(forecast.lowestCashPeriod) : "the forecast"}.</Banner>
              ) : null}
              <Panel title="Cash at bank" icon="bank" subtitle={scenario.isBase ? "Base case with its likely range" : "This scenario against the base case and its likely range"} actions={forecast?.stale ? <Badge tone="warning">Updating</Badge> : null}>
                {forecast ? (
                  <LineChart labels={chart.labels} series={chart.series as never} forecastFrom={chart.forecastFrom} todayLabel="Today" zero endLabels scenarioArea thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]} />
                ) : (
                  <p className="ll-muted">Running the forecast…</p>
                )}
              </Panel>
              <div className="ll-grid-halves">
                <Panel title="Runway" icon="runway">
                  {forecast ? (
                    <RunwayGauge
                      months={forecast.runwayMonths ?? 24}
                      cashOut={forecast.cashOutPeriod ? periodLabel(forecast.cashOutPeriod) : "Beyond the forecast"}
                      compare={!scenario.isBase && baseForecast ? (baseForecast.runwayMonths ?? 24) : undefined}
                      compareLabel="Base case"
                      size={230}
                    />
                  ) : null}
                </Panel>
                <Panel title="What moves runway most" icon="compare" subtitle="Each driver from its downside to its upside">
                  {forecast?.sensitivity?.rows.length ? (
                    <TornadoChart base={forecast.sensitivity.base} rows={forecast.sensitivity.rows.slice(0, 5)} baseLabel={forecast.sensitivity.capped ? "Beyond" : "Base"} />
                  ) : (
                    <p className="ll-muted">Appears once the forecast has run.</p>
                  )}
                </Panel>
              </div>
              {forecast ? (
                <Panel title="Three statements" icon="statement" subtitle="Every month balances: assets less liabilities equal equity" actions={<Tabs label="Statement" value={statementTab} onChange={setStatementTab} tabs={[{ id: "pnl", label: "Profit and loss" }, { id: "bs", label: "Balance sheet" }, { id: "cf", label: "Cash flow" }]} />} flush>
                  <ForecastStatement run={forecast} kind={statementTab} />
                </Panel>
              ) : null}
            </div>
          </div>
        );
      }}
    </AppPage>
  );
}

const round = (v: number) => Math.round(v * 100) / 100;

function ForecastStatement({ run, kind }: { run: ForecastRun; kind: string }) {
  const months = run.months.slice(0, 12);
  const columns = months.map((m) => ({ label: m.label, kind: "F" }));
  const line = (label: string, pick: (m: ForecastRun["months"][number]) => number, type = "line") => ({ type, label, values: months.map((m) => pick(m) / 100) });
  const rows =
    kind === "pnl"
      ? [
          line("Revenue", (m) => m.revenue),
          line("Cost of sales", (m) => m.costOfSales),
          line("Gross profit", (m) => m.grossProfit, "subtotal"),
          line("Overheads", (m) => m.overheads),
          line("New hires", (m) => m.hires),
          line("EBITDA", (m) => m.ebitda, "subtotal"),
          line("Depreciation", (m) => m.depreciation),
          line("Interest", (m) => m.interest),
          line("Corporation tax", (m) => m.tax),
          line("Net profit", (m) => m.netProfit, "total"),
        ]
      : kind === "bs"
        ? [
            line("Cash at bank", (m) => m.cash),
            line("Trade debtors", (m) => m.debtors),
            line("Trade creditors", (m) => -m.creditors),
            line("Bank loan", (m) => -m.loan),
            line("Equity", (m) => m.equity, "total"),
          ]
        : [
            line("Net profit", (m) => m.netProfit),
            line("Closing cash", (m) => m.cash, "total"),
          ];
  return (
    <div style={{ padding: "0 20px 20px" }}>
      <FinancialStatement title="Forecast" columns={columns} rows={rows as never} forecastFrom={0} drillable={false} dense />
    </div>
  );
}

function PlanList({ items, onRemove, form, readOnly }: { items: { id: string; what: string; when: string; kind: string; amount: number }[]; onRemove: (id: string) => void; form: React.ReactNode; readOnly: boolean }) {
  return (
    <div className="ll-stack" style={{ marginTop: 12 }}>
      {items.length ? (
        <DataTable
          columns={[
            { key: "what", label: "Item" },
            { key: "when", label: "Month" },
            { key: "amount", label: "Amount", numeric: true, render: (r: { amount: number }) => money(r.amount) },
            { key: "x", label: "", render: (r: { id: string }) => (readOnly ? null : <Button size="sm" variant="ghost" icon="trash" onClick={() => onRemove(r.id)}>Remove</Button>) },
          ]}
          rows={items}
        />
      ) : (
        <p className="ll-muted">Nothing planned yet.</p>
      )}
      {readOnly ? <p className="ll-muted">Branch the base case to add plans.</p> : form}
    </div>
  );
}

function monthOptions(start: string) {
  const out = [];
  let [y, m] = start.split("-").map(Number);
  for (let i = 0; i < 24; i++) {
    const p = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ value: p, label: periodLabel(p) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function AddHire({ start, onAdd }: { start: string; onAdd: (h: { role: string; salaryCents: number; startPeriod: string; count: number }) => void }) {
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [period, setPeriod] = useState(start);
  const [count, setCount] = useState("1");
  const valid = role.trim() && Number(salary) > 0 && Number(count) >= 1;
  return (
    <div className="ll-stack" style={{ padding: 12, border: "1px dashed var(--rule)", borderRadius: 12 }}>
      <Input id="hire-role" label="Role" placeholder="Cabinet maker" value={role} onChange={(e) => setRole(e.target.value)} />
      <div className="ll-grid-halves" style={{ gap: 12 }}>
        <Input id="hire-salary" label="Annual salary" prefix="€" numeric value={salary} onChange={(e) => setSalary(e.target.value.replace(/[^\d.]/g, ""))} hint="Employer PRSI of 11.15% is added" />
        <Input id="hire-count" label="How many" numeric value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />
      </div>
      <Select id="hire-start" label="Starts" value={period} onChange={(e) => setPeriod(e.target.value)} options={monthOptions(start)} />
      <Button icon="plus" disabled={!valid} onClick={() => { onAdd({ role: role.trim(), salaryCents: Math.round(Number(salary) * 100), startPeriod: period, count: Number(count) }); setRole(""); setSalary(""); }}>
        Add hire
      </Button>
    </div>
  );
}

function AddOneOff({ start, onAdd }: { start: string; onAdd: (o: { label: string; period: string; amountCents: number; kind: "capex" | "income" | "expense" }) => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(start);
  const [kind, setKind] = useState<"capex" | "income" | "expense">("capex");
  return (
    <div className="ll-stack" style={{ padding: 12, border: "1px dashed var(--rule)", borderRadius: 12 }}>
      <Input id="oneoff-label" label="What" placeholder="CNC router" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="ll-grid-halves" style={{ gap: 12 }}>
        <Select id="oneoff-kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} options={[{ value: "capex", label: "Equipment (depreciated)" }, { value: "income", label: "One-off income" }, { value: "expense", label: "One-off expense" }]} />
        <Input id="oneoff-amount" label="Amount" prefix="€" numeric value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      <Select id="oneoff-period" label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} options={monthOptions(start)} />
      <Button icon="plus" disabled={!label.trim() || !(Number(amount) > 0)} onClick={() => { onAdd({ label: label.trim(), period, amountCents: Math.round(Number(amount) * 100), kind }); setLabel(""); setAmount(""); }}>
        Add item
      </Button>
    </div>
  );
}

function AddFinancing({ start, onAdd }: { start: string; onAdd: (f: { period: string; amountCents: number; kind: "loan" | "equity" | "dividend" }) => void }) {
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(start);
  const [kind, setKind] = useState<"loan" | "equity" | "dividend">("loan");
  return (
    <div className="ll-stack" style={{ padding: 12, border: "1px dashed var(--rule)", borderRadius: 12 }}>
      <div className="ll-grid-halves" style={{ gap: 12 }}>
        <Select id="fin-kind" label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} options={[{ value: "loan", label: "Draw a loan" }, { value: "equity", label: "Raise equity" }, { value: "dividend", label: "Pay a dividend" }]} />
        <Input id="fin-amount" label="Amount" prefix="€" numeric value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      <Select id="fin-period" label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} options={monthOptions(start)} />
      <Button icon="plus" disabled={!(Number(amount) > 0)} onClick={() => { onAdd({ period, amountCents: Math.round(Number(amount) * 100), kind }); setAmount(""); }}>
        Add
      </Button>
    </div>
  );
}

export default function ForecastPage() {
  return (
    <Suspense>
      <ForecastScreen />
    </Suspense>
  );
}
