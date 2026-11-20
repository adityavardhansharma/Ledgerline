"use client";

import { Badge, formatMoney, IconButton, Menu, Sparkline } from "@ledgerline/ui";
import { Button } from "@ui-sdk/react/button";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ForecastRun } from "@/lib/types";
import type { useScenarios } from "./useForecast";

type ScenarioSummary = NonNullable<ReturnType<typeof useScenarios>["scenarios"]>[number];

/** One scenario as a row: what it is, its cash line, the figures that matter, and its actions. */
export function ScenarioRow({ scenario, comparing, onCompare, onOpen, onDelete }: { scenario: ScenarioSummary; comparing: boolean; onCompare?: () => void; onOpen: () => void; onDelete?: () => void }) {
  const run = useQuery(api.forecast.latest, { scenarioId: scenario.id }) as ForecastRun | null | undefined;
  const sum = scenario.summary;
  const cash = run?.months.map((m) => m.cash / 100) ?? [];
  const money = (cents: number | null | undefined) => (cents == null ? "–" : formatMoney(cents / 100));
  const runsOut = sum?.runwayMonths != null && run?.cashOutPeriod;
  const name = (
    <>
      <b>
        {scenario.name}
        {scenario.isBase ? <Badge tone="brand">Base</Badge> : comparing ? <Badge tone="forecast">Comparing</Badge> : null}
      </b>
      <small>{scenario.isBase ? "Drivers from your actuals" : `From ${scenario.parentName ?? "the base case"} · ${scenario.changes} change${scenario.changes === 1 ? "" : "s"}`}</small>
    </>
  );
  return (
    <div className={`ll-scn-row${comparing ? " is-on" : ""}${onCompare ? " is-pickable" : ""}`} role="listitem" onClick={onCompare}>
      {onCompare ? (
        <Button
          render={<span />}
          className="ll-scn-name"
          aria-pressed={comparing}
          aria-label={`Compare with ${scenario.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onCompare();
          }}
        >
          {name}
        </Button>
      ) : (
        <span className="ll-scn-name">{name}</span>
      )}
      <span className="ll-scn-spark">{cash.length > 1 ? <Sparkline data={cash} width={150} height={34} tone={cash.some((v) => v < 0) ? "negative" : undefined} label={`${scenario.name} cash`} /> : <i className="ll-muted">Running…</i>}</span>
      <span className={`ll-scn-num${(sum?.lowestCash ?? 0) < 0 ? " is-bad" : ""}`}>{money(sum?.lowestCash)}</span>
      <span className="ll-scn-num">{money(sum?.endCash)}</span>
      <span className={`ll-scn-num${runsOut ? " is-bad" : ""}`}>{runsOut ? `${sum!.runwayMonths!.toFixed(1)} mo` : "24+ mo"}</span>
      <span className="ll-scn-actions" onClick={(e) => e.stopPropagation()}>
        <Menu
          trigger={<IconButton icon="more" label={`Actions for ${scenario.name}`} size="sm" />}
          items={[
            { label: "Open in forecast", icon: "forecast", onClick: onOpen },
            ...(onDelete ? [{ divider: true }, { label: "Delete scenario", icon: "trash" as const, danger: true, confirm: `Deletes the scenario ${scenario.name}`, onClick: onDelete }] : []),
          ]}
        />
      </span>
    </div>
  );
}
