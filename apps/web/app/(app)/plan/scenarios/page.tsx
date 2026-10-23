"use client";

import { Badge, BulletChart, Button, EmptyState, formatMoney, IconButton, LineChart, Menu, Panel, ScenarioCompare, Sparkline } from "@ledgerline/ui";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { ExportMenu } from "@/components/app/ExportMenu";
import { euro, forecastCsv, toCsv } from "@/lib/csv";
import { BranchDialog } from "@/components/app/BranchDialog";
import { useScenarios } from "@/components/app/useForecast";
import { RailBlock, ReportGrid } from "@/components/app/report/Report";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { periodLabel } from "@/lib/format";
import { ROUTES } from "@/lib/nav";
import type { ForecastRun } from "@/lib/types";

export default function ScenariosPage() {
  const router = useRouter();
  const { scenarios, base } = useScenarios();
  const run = useAction(api.forecast.run);
  const remove = useMutation(api.scenarios.remove);
  const [compareId, setCompareId] = useState<Id<"scenarios"> | null>(null);
  const [menuFor, setMenuFor] = useState<Id<"scenarios"> | null>(null);
  const [branching, setBranching] = useState(false);
  const asked = useRef(new Set<string>());

  // Make sure every scenario has a forecast on the current actuals.
  useEffect(() => {
    for (const s of scenarios ?? []) {
      if (!s.summary && !asked.current.has(s.id)) {
        asked.current.add(s.id);
        void run({ scenarioId: s.id }).catch(() => undefined);
      }
    }
  }, [scenarios, run]);

  const other = scenarios?.find((s) => s.id === compareId) ?? scenarios?.find((s) => !s.isBase);
  const baseRun = useQuery(api.forecast.latest, base ? { scenarioId: base.id } : "skip") as ForecastRun | null | undefined;
  const otherRun = useQuery(api.forecast.latest, other ? { scenarioId: other.id } : "skip") as ForecastRun | null | undefined;

  const side = (s: NonNullable<typeof scenarios>[number] | undefined) =>
    s
      ? {
          name: s.name,
          runway: s.summary?.runwayMonths ?? null,
          cash: s.summary?.endCash != null ? s.summary.endCash / 100 : null,
          ebitda: s.summary?.ebitdaFirst12 != null ? s.summary.ebitdaFirst12 / 100 : null,
          minCash: s.summary?.lowestCash != null ? s.summary.lowestCash / 100 : null,
          revenue: s.summary?.revenueFirst12 != null ? s.summary.revenueFirst12 / 100 : null,
        }
      : null;

  return (
    <AppPage
      active="scenarios"
      title="Scenarios"
      subtitle={scenarios ? `${scenarios.length} plan${scenarios.length === 1 ? "" : "s"} for the next two years` : undefined}
      breadcrumbs={["Plan", "Scenarios"]}
      needsData
      actions={
        <>
          <ExportMenu
            title="Scenarios"
            disabled={!scenarios?.length}
            csv={[
              {
                label: "Scenario comparison",
                build: () =>
                  scenarios?.length
                    ? toCsv([
                        ["Scenario", "Branched from", "Runway (months)", "Lowest cash", "Cash at end", "Revenue, first 12 months", "EBITDA, first 12 months"],
                        ...scenarios.map((s) => [s.name, s.isBase ? "" : (scenarios.find((p) => p.id === s.parentId)?.name ?? ""), s.summary?.runwayMonths ?? "", euro(s.summary?.lowestCash), euro(s.summary?.endCash), euro(s.summary?.revenueFirst12), euro(s.summary?.ebitdaFirst12)]),
                      ])
                    : null,
              },
              {
                label: "Compared forecasts, monthly",
                build: () => (baseRun && base ? forecastCsv(baseRun, base.name) + (otherRun && other && other.id !== base.id ? forecastCsv(otherRun, other.name).split("\n").slice(1).join("\n") : "") : null),
              },
            ]}
          />
          {base ? <Button variant="primary" icon="branch" onClick={() => setBranching(true)}>Branch the base case</Button> : null}
        </>
      }
      overlay={branching && base ? <BranchDialog fromId={base.id} fromName={base.name} onClose={() => setBranching(false)} onCreated={(id) => router.push(`${ROUTES.forecast}?scenario=${id}`)} /> : null}
    >
      {() => {
        if (!scenarios || !base) return null;
        const a = side(base)!;
        const b = side(other);
        return (
          <>
            <section className="ll-report-hero is-flush">
              <div className="ll-scn-list" role="list">
                <div className="ll-scn-row is-head" aria-hidden>
                  <span>Scenario</span>
                  <span>Cash over two years</span>
                  <span>Lowest cash</span>
                  <span>Cash in two years</span>
                  <span>Runway</span>
                  <span />
                </div>
                {scenarios.map((s) => (
                  <ScenarioRow
                    key={s.id}
                    scenario={s}
                    comparing={!s.isBase && s.id === other?.id}
                    onCompare={s.isBase ? undefined : () => setCompareId(s.id)}
                    menuOpen={menuFor === s.id}
                    onMenu={() => setMenuFor(menuFor === s.id ? null : s.id)}
                    onOpen={() => router.push(`${ROUTES.forecast}?scenario=${s.id}`)}
                    onDelete={s.isBase ? undefined : () => { setMenuFor(null); void remove({ id: s.id }); }}
                  />
                ))}
              </div>
            </section>
            {other && b ? (
              <>
                <ReportGrid
                  main={
                  <section className="ll-report-hero">
                    <h2>Base case against {other.name}</h2>
                    <p className="ll-report-hero-sub">Month-end cash over the next two years{otherRun?.cashOutPeriod ? `; ${other.name} runs out in ${periodLabel(otherRun.cashOutPeriod)}` : ""}.</p>
                    {baseRun && otherRun ? (
                      <LineChart
                        labels={baseRun.months.map((m) => m.label)}
                        zero
                        endLabels
                        scenarioArea
                        height={300}
                        thresholds={[{ value: 0, label: "CASH RUNS OUT", tone: "negative" }]}
                        series={[
                          { name: "Base case", kind: "forecast", values: baseRun.months.map((m) => m.cash / 100) },
                          { name: other.name, kind: "scenario", values: otherRun.months.map((m) => m.cash / 100) },
                        ]}
                      />
                    ) : (
                      <p className="ll-muted">Running both forecasts…</p>
                    )}
                  </section>
                  }
                  rail={
                    <RailBlock title="Runway by scenario">
                      <BulletChart rows={scenarios.map((s) => ({ label: s.name, actual: s.summary?.runwayMonths ?? 24, target: 12, max: 24, bands: [6, 12, 24], format: (v: number) => (s.summary?.runwayMonths == null ? "24+ mo" : `${v.toFixed(1)} mo`) }))} />
                    </RailBlock>
                  }
                />
                <Panel title="What changes" icon="statement" subtitle={otherRun?.cashOutPeriod ? `${other.name} runs out of cash in ${periodLabel(otherRun.cashOutPeriod)}` : undefined} flush>
                  <div style={{ padding: "0 20px 20px" }}>
                    <ScenarioCompare a={a} b={b} horizon={24} cashLabel="Cash in 2 years" />
                  </div>
                </Panel>
              </>
            ) : (
              <div className="ll-panel">
                <EmptyState icon="scenario" title="No scenarios yet" action={<Button variant="forecast" icon="branch" onClick={() => setBranching(true)}>Branch the base case</Button>}>
                  Copy the base case and change hires, growth or payment terms without touching it. <Link href={ROUTES.forecast}>See the base case</Link>.
                </EmptyState>
              </div>
            )}
          </>
        );
      }}
    </AppPage>
  );
}

type ScenarioSummary = NonNullable<ReturnType<typeof useScenarios>["scenarios"]>[number];

/** One scenario as a row: what it is, its cash line, the figures that matter, and its actions. */
function ScenarioRow({ scenario, comparing, onCompare, menuOpen, onMenu, onOpen, onDelete }: { scenario: ScenarioSummary; comparing: boolean; onCompare?: () => void; menuOpen: boolean; onMenu: () => void; onOpen: () => void; onDelete?: () => void }) {
  const run = useQuery(api.forecast.latest, { scenarioId: scenario.id }) as ForecastRun | null | undefined;
  const sum = scenario.summary;
  const cash = run?.months.map((m) => m.cash / 100) ?? [];
  const money = (cents: number | null | undefined) => (cents == null ? "–" : formatMoney(cents / 100));
  const runsOut = sum?.runwayMonths != null && run?.cashOutPeriod;
  return (
    <div className={`ll-scn-row${comparing ? " is-on" : ""}${onCompare ? " is-pickable" : ""}`} role="listitem" onClick={onCompare}>
      <span className="ll-scn-name">
        <b>
          {scenario.name}
          {scenario.isBase ? <Badge tone="brand">Base</Badge> : comparing ? <Badge tone="forecast">Comparing</Badge> : null}
        </b>
        <small>{scenario.isBase ? "Drivers from your actuals" : `From ${scenario.parentName ?? "the base case"} · ${scenario.changes} change${scenario.changes === 1 ? "" : "s"}`}</small>
      </span>
      <span className="ll-scn-spark">{cash.length > 1 ? <Sparkline data={cash} width={150} height={34} tone={cash.some((v) => v < 0) ? "negative" : undefined} label={`${scenario.name} cash`} /> : <i className="ll-muted">Running…</i>}</span>
      <span className={`ll-scn-num${(sum?.lowestCash ?? 0) < 0 ? " is-bad" : ""}`}>{money(sum?.lowestCash)}</span>
      <span className="ll-scn-num">{money(sum?.endCash)}</span>
      <span className={`ll-scn-num${runsOut ? " is-bad" : ""}`}>{runsOut ? `${sum!.runwayMonths!.toFixed(1)} mo` : "24+ mo"}</span>
      <span className="ll-scn-actions" onClick={(e) => e.stopPropagation()}>
        <IconButton icon="more" label={`Actions for ${scenario.name}`} size="sm" onClick={onMenu} />
        {menuOpen ? (
          <span className="ll-scn-menu">
            <Menu
              label={`Actions for ${scenario.name}`}
              items={[
                { label: "Open in forecast", icon: "forecast", onClick: onOpen },
                ...(onDelete ? [{ divider: true }, { label: "Delete scenario", icon: "trash" as const, danger: true, onClick: onDelete }] : []),
              ]}
            />
          </span>
        ) : null}
      </span>
    </div>
  );
}
