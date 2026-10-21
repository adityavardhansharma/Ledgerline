"use client";

import { BulletChart, Button, EmptyState, IconButton, LineChart, Menu, Panel, ScenarioCard, ScenarioCompare } from "@ledgerline/ui";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppPage";
import { BranchDialog } from "@/components/app/BranchDialog";
import { useScenarios } from "@/components/app/useForecast";
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
      actions={base ? <Button variant="primary" icon="branch" onClick={() => setBranching(true)}>Branch the base case</Button> : null}
      overlay={branching && base ? <BranchDialog fromId={base.id} fromName={base.name} onClose={() => setBranching(false)} onCreated={(id) => router.push(`${ROUTES.forecast}?scenario=${id}`)} /> : null}
    >
      {() => {
        if (!scenarios || !base) return null;
        const a = side(base)!;
        const b = side(other);
        return (
          <>
            <div className="ll-grid-kpi" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {scenarios.map((s) => (
                <div key={s.id} style={{ position: "relative" }}>
                  <ScenarioCard
                    name={s.name}
                    base={s.isBase}
                    parent={s.parentName ?? undefined}
                    changes={s.changes}
                    runway={s.summary?.runwayMonths ?? null}
                    cash={s.summary?.endCash != null ? s.summary.endCash / 100 : null}
                    ebitda={s.summary?.ebitdaFirst12 != null ? s.summary.ebitdaFirst12 / 100 : null}
                    horizon={24}
                    cashLabel="Cash in 2 years"
                    active={s.isBase}
                    compare={!s.isBase && s.id === other?.id}
                    onSelect={s.isBase ? undefined : () => setCompareId(s.id)}
                    menu={<IconButton icon="more" label={`Actions for ${s.name}`} size="sm" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === s.id ? null : s.id); }} />}
                  />
                  {menuFor === s.id ? (
                    <div style={{ position: "absolute", right: 12, top: 48, zIndex: 30 }}>
                      <Menu
                        label={`Actions for ${s.name}`}
                        items={[
                          { label: "Open in forecast", icon: "forecast", onClick: () => router.push(`${ROUTES.forecast}?scenario=${s.id}`) },
                          ...(s.isBase ? [] : [{ divider: true }, { label: "Delete scenario", icon: "trash" as const, danger: true, onClick: () => { setMenuFor(null); void remove({ id: s.id }); } }]),
                        ]}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {other && b ? (
              <>
                <div className="ll-grid-2">
                  <Panel title={`Base case against ${other.name}`} icon="compare" subtitle="Month-end cash over the next two years">
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
                  </Panel>
                  <Panel title="Runway by scenario" icon="runway">
                    <BulletChart rows={scenarios.map((s) => ({ label: s.name, actual: s.summary?.runwayMonths ?? 24, target: 12, max: 24, bands: [6, 12, 24], format: (v: number) => (s.summary?.runwayMonths == null ? "24+ mo" : `${v.toFixed(1)} mo`) }))} />
                  </Panel>
                </div>
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
