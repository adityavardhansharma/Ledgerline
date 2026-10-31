"use client";

import {
  Badge,
  Banner,
  FinancialStatement,
  formatMoney,
  Button,
  Icon,
  Select,
  LineChart,
  Tabs,
  TornadoChart,
} from "@ledgerline/ui";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { forecastCsv, toCsv } from "@/lib/csv";
import { BranchDialog } from "@/components/app/BranchDialog";
import { CashDipExplainer } from "@/components/app/ai/Explainers";
import { DownsideButton, NameSuggest, ScenarioComposer } from "@/components/app/ai/Planners";
import { AddFinancing, AddHire, AddOneOff, FINANCING, loaded, ONE_OFF, PlanList, Sections } from "@/components/app/PlanItems";
import { DriverField } from "@/components/app/DriverField";
import { useForecast, useScenarios } from "@/components/app/useForecast";
import { useSetOverride, useSetPlanItems } from "@/components/app/useScenarioEdits";
import { forecastBehind } from "@/lib/scenarioEdits";
import { moneyChange, SummaryLine } from "@/components/app/report/Report";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { money, periodLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import type { ForecastRun, Snapshot } from "@/lib/types";
import { cashChart, cashLede } from "@/lib/views";

// Drivers in groups: key, label, unit, scale (stored value × scale = shown value), min, max, step, help.
const DRIVER_GROUPS: { title: string; drivers: [string, string, string, number, number, number, number, string][] }[] = [
  {
    title: "Revenue",
    drivers: [
      ["growth", "Growth a month", "%", 100, -5, 10, 0.1, "Compound, from last month's revenue."],
      ["grossMargin", "Gross margin", "%", 100, 0, 90, 0.5, "Gross profit as a share of revenue."],
    ],
  },
  { title: "Costs", drivers: [["overheadGrowth", "Overheads growth a year", "%", 100, -20, 30, 0.5, "Applied to today's monthly overheads."]] },
  {
    title: "Working capital",
    drivers: [
      ["debtorDays", "Debtor days", "days", 1, 0, 120, 1, "How long customers take to pay."],
      ["creditorDays", "Creditor days", "days", 1, 0, 120, 1, "How long you take to pay suppliers."],
      ["stockDays", "Stock days", "days", 1, 0, 120, 1, "Stock held, in days of cost of sales."],
    ],
  },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function ForecastScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { scenarios, base } = useScenarios();
  const scenarioId = (params.get("scenario") as Id<"scenarios"> | null) ?? base?.id;
  const scenario = useQuery(api.scenarios.get, scenarioId ? { id: scenarioId } : "skip");
  const snapshot = useQuery(api.reports.statements) as Snapshot | null | undefined;
  const setOverride = useSetOverride();
  const setPlanItems = useSetPlanItems();
  const forecast = useForecast(scenarioId) as ForecastRun | null | undefined;
  const baseForecast = useForecast(base && base.id !== scenarioId ? base.id : undefined) as ForecastRun | null | undefined;
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
          <ExportMenu
            title={scenario ? `Forecast: ${scenario.name}` : "Forecast"}
            disabled={!forecast}
            csv={[
              { label: scenario ? `${scenario.name} forecast` : "Forecast", build: () => (forecast && scenario ? forecastCsv(forecast, scenario.name) : null) },
              ...(forecast?.sensitivity
                ? [{ label: "Runway sensitivity", build: () => toCsv([["Driver", "Range", "Runway low (months)", "Runway high (months)"], ...forecast.sensitivity!.rows.map((r) => [r.label, r.range, r.low, r.high])]) }]
                : []),
            ]}
          />
          {scenario && !scenario.isBase && scenarioId ? <NameSuggest scenarioId={scenarioId} current={scenario.name} /> : null}
          <DownsideButton onCreated={(id) => router.push(`${ROUTES.forecast}?scenario=${id}`)} />
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
        const cashAt = (i: number) => (forecast?.months[i] ? forecast.months[i].cash / 100 : null);
        const vsBase = (mine: number | null, theirs: number | null) => (scenario.isBase || mine === null || theirs === null ? {} : { change: mine - theirs, changeText: moneyChange(mine - theirs), good: "up" as const, note: "on the base case" });
        const baseAt = (i: number) => (baseForecast?.months[i] ? baseForecast.months[i].cash / 100 : null);
        return (
          <>
          {forecast ? (
            <SummaryLine
              figures={[
                { label: "Lowest cash", value: forecast.lowestCash === null ? "–" : formatMoney(forecast.lowestCash / 100), note: forecast.lowestCashPeriod ? periodLabel(forecast.lowestCashPeriod) : undefined },
                { label: "Cash in a year", value: cashAt(11) === null ? "–" : formatMoney(cashAt(11)!), ...vsBase(cashAt(11), baseAt(11)) },
                { label: "Cash in two years", value: cashAt(23) === null ? "–" : formatMoney(cashAt(23)!), ...vsBase(cashAt(23), baseAt(23)) },
                { label: "Runway", value: forecast.cashOutPeriod ? `${(forecast.runwayMonths ?? 0).toFixed(1)} months` : "24+ months", note: forecast.cashOutPeriod ? `cash runs out in ${periodLabel(forecast.cashOutPeriod)}` : "lasts the whole forecast" },
              ]}
            />
          ) : null}
          <div className="ll-workspace">
            <div className="ll-workspace-main">
              {forecast?.cashOutPeriod ? (
                <Banner tone="negative" title={`Cash runs out in ${periodLabel(forecast.cashOutPeriod)}.`}>
                  {(forecast.lowestCash ?? 0) < 0
                    ? `At its lowest, in ${forecast.lowestCashPeriod ? periodLabel(forecast.lowestCashPeriod) : "the forecast"}, the account would be overdrawn by ${money(Math.abs(forecast.lowestCash ?? 0))}. `
                    : ""}
                  Add a loan or equity under Financing, or move costs later.
                </Banner>
              ) : null}
              <section className="ll-report-hero">
                <header className="ll-hero-head">
                  <div>
                    <h2>How long will the cash last?</h2>
                    <p className="ll-report-hero-sub">
                      {cashLede(forecast, scenario.isBase ? "the base case" : `“${scenario.name}”`)} {scenario.isBase ? "Shaded, its likely range." : "Against the base case; shaded, its likely range."}
                    </p>
                  </div>
                  {forecastBehind(forecast, scenario, snapshot?.drivers) ? <Badge tone="warning">Updating</Badge> : null}
                </header>
                {forecast ? (
                  <LineChart labels={chart.labels} series={chart.series as never} forecastFrom={chart.forecastFrom} todayLabel="Today" zero endLabels scenarioArea negativeNote="overdrawn" height={320} thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]} />
                ) : (
                  <p className="ll-muted">Running the forecast…</p>
                )}
              </section>
              {forecast && scenarioId ? <CashDipExplainer scenarioId={scenarioId} onOpenArea={(area) => { setTab(area); document.querySelector(".ll-inspector")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} /> : null}
              <section className="ll-report-hero">
                <header className="ll-hero-head">
                  <div>
                    <h2>What moves runway most</h2>
                    <p className="ll-report-hero-sub">Each driver from its downside to its upside</p>
                  </div>
                </header>
                  {forecast?.sensitivity?.rows.length && forecast.sensitivity.rows.some((r) => Math.abs(r.low) >= 0.05 || Math.abs(r.high) >= 0.05) ? (
                    <TornadoChart base={forecast.sensitivity.base} rows={forecast.sensitivity.rows.slice(0, 5)} baseLabel="Base" />
                  ) : forecast?.sensitivity?.rows.length ? (
                    <div className="ll-plan-empty">
                      <Icon name="success" size={20} />
                      <p>Cash lasts the whole forecast even at each driver&apos;s downside, so no single driver moves runway. Branch a tougher scenario to stress-test it.</p>
                    </div>
                  ) : (
                    <p className="ll-muted">Appears once the forecast has run.</p>
                  )}
              </section>
              {forecast ? (
                <section className="ll-report-hero is-flush">
                  <header className="ll-section-head">
                    <div>
                      <h2>Three statements</h2>
                      <span>Every month balances: assets less liabilities equal equity</span>
                    </div>
                    <Tabs label="Statement" value={statementTab} onChange={setStatementTab} tabs={[{ id: "pnl", label: "Profit and loss" }, { id: "bs", label: "Balance sheet" }, { id: "cf", label: "Cash flow" }]} />
                  </header>
                  <ForecastStatement run={forecast} kind={statementTab} />
                </section>
              ) : null}
            </div>
            <aside className="ll-inspector" aria-label="Drivers">
              <div className="ll-inspector-inner">
              <header className="ll-inspector-head">
                <h2>Drivers</h2>
                <p>{readOnly ? "The base case follows your actuals. Branch it to change anything." : "Changes from the parent scenario are marked."}</p>
              </header>
              {!readOnly && scenarioId ? <ScenarioComposer scenarioId={scenarioId} startPeriod={snapshot.drivers.startPeriod} own={scenario.own} /> : null}
              <Sections
                value={tab}
                onChange={setTab}
                items={[
                  { id: "assumptions", label: "Assumptions", count: Object.keys(scenario.own.overrides).length },
                  { id: "hires", label: "Hires", count: scenario.hires.length },
                  { id: "oneoffs", label: "One-offs", count: scenario.oneOffs.length },
                  { id: "financing", label: "Financing", count: scenario.financing.length },
                ]}
              />
              <div className="ll-drv-body">
                {tab === "assumptions" &&
                  DRIVER_GROUPS.map((group) => (
                    <section key={group.title} className="ll-drv-group">
                      <h3>{group.title}</h3>
                      {group.drivers.map(([key, label, unit, scale, min, max, step, help]) => (
                        <DriverField
                          key={`${scenarioId}-${key}`}
                          id={`driver-${key}`}
                          label={label}
                          unit={unit}
                          min={min}
                          max={max}
                          step={step}
                          value={round(value(key) * scale)}
                          parent={scenario.isBase ? undefined : round(parentValue(key) * scale)}
                          help={help}
                          readOnly={readOnly}
                          onChange={(v) => commit(key, v, scale)}
                          onReset={key in scenario.own.overrides && scenarioId ? () => void setOverride({ id: scenarioId, key, value: null }) : undefined}
                        />
                      ))}
                    </section>
                  ))}
                {tab === "hires" && (
                  <PlanList
                    readOnly={readOnly}
                    empty="No hires planned. Each hire adds its salary and employer PRSI to the forecast from the month they start."
                    total={scenario.hires.length ? `${money(Math.round(scenario.hires.reduce((t, h) => t + loaded(h.salaryCents, h.count), 0)))} a month once everyone has started` : undefined}
                    items={scenario.hires.map((h) => ({
                      id: h.id,
                      icon: "hire" as const,
                      tone: "forecast",
                      title: h.count > 1 ? `${h.role} × ${h.count}` : h.role,
                      meta: `Starts ${periodLabel(h.startPeriod)} · ${money(h.salaryCents)} a year${h.count > 1 ? " each" : ""}`,
                      amount: -loaded(h.salaryCents, h.count),
                      note: "a month",
                      own: ownHires.some((o) => o.id === h.id),
                    }))}
                    onRemove={(id) => void setPlanItems({ id: scenario.id, hires: ownHires.filter((o) => o.id !== id) })}
                    form={<AddHire start={snapshot.drivers.startPeriod} onAdd={(h) => void setPlanItems({ id: scenario.id, hires: [...ownHires, { ...h, id: uid() }] })} />}
                  />
                )}
                {tab === "oneoffs" && (
                  <PlanList
                    readOnly={readOnly}
                    empty="No one-offs planned. Add equipment you'll buy, or a single payment in or out."
                    items={scenario.oneOffs.map((o) => ({
                      id: o.id,
                      icon: o.kind === "capex" ? ("settings" as const) : o.kind === "income" ? ("arrow-down" as const) : ("arrow-up" as const),
                      tone: o.kind === "income" ? "positive" : o.kind === "capex" ? "brand" : "negative",
                      title: o.label,
                      meta: `${ONE_OFF[o.kind]} · ${periodLabel(o.period)}`,
                      amount: o.kind === "income" ? o.amountCents : -o.amountCents,
                      note: "once",
                      own: scenario.own.oneOffs.some((x) => x.id === o.id),
                    }))}
                    onRemove={(id) => void setPlanItems({ id: scenario.id, oneOffs: scenario.own.oneOffs.filter((o) => o.id !== id) })}
                    form={<AddOneOff start={snapshot.drivers.startPeriod} onAdd={(o) => void setPlanItems({ id: scenario.id, oneOffs: [...scenario.own.oneOffs, { ...o, id: uid() }] })} />}
                  />
                )}
                {tab === "financing" && (
                  <PlanList
                    readOnly={readOnly}
                    empty="No financing planned. Add a loan or equity to cover a gap, or a dividend you plan to pay."
                    items={scenario.financing.map((f) => ({
                      id: f.id,
                      icon: f.kind === "dividend" ? ("arrow-up" as const) : ("bank" as const),
                      tone: f.kind === "dividend" ? "negative" : "positive",
                      title: FINANCING[f.kind],
                      meta: periodLabel(f.period),
                      amount: f.kind === "dividend" ? -f.amountCents : f.amountCents,
                      note: f.kind === "dividend" ? "paid out" : "cash in",
                      own: scenario.own.financing.some((x) => x.id === f.id),
                    }))}
                    onRemove={(id) => void setPlanItems({ id: scenario.id, financing: scenario.own.financing.filter((f) => f.id !== id) })}
                    form={<AddFinancing start={snapshot.drivers.startPeriod} onAdd={(f) => void setPlanItems({ id: scenario.id, financing: [...scenario.own.financing, { ...f, id: uid() }] })} />}
                  />
                )}
              </div>
              </div>
            </aside>
          </div>
          </>
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
    <div className="ll-pad">
      <FinancialStatement title="Forecast" columns={columns} rows={rows as never} forecastFrom={0} drillable={false} dense />
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
