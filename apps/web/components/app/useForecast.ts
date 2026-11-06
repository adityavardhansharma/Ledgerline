"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ForecastRun } from "@/lib/types";

/**
 * The newest forecast for a scenario. The backend rebuilds forecasts whenever their inputs or the actuals change,
 * so a page only reads; it asks for a run itself only when there is none yet, or the one stored predates the
 * current actuals (a forecast made before the backend kept them up to date).
 */
export function useForecast(scenarioId: Id<"scenarios"> | undefined) {
  const latest = useQuery(api.forecast.latest, scenarioId ? { scenarioId } : "skip") as ForecastRun | null | undefined;
  const run = useAction(api.forecast.run);
  const asked = useRef<string>("");
  const missing = latest === null || Boolean(latest?.stale);
  useEffect(() => {
    if (!scenarioId || !missing) return;
    const key = `${scenarioId}:${latest?.createdAt ?? "none"}`;
    if (asked.current === key) return;
    asked.current = key;
    void run({ scenarioId }).catch(() => undefined);
  }, [scenarioId, missing, latest?.createdAt, run]);
  return latest;
}

export function useScenarios() {
  const scenarios = useQuery(api.scenarios.list);
  const base = scenarios?.find((s) => s.isBase);
  return { scenarios, base };
}

const REPORT_SCENARIO = "ll-report-scenario";

/**
 * The scenario whose forecast fills the reports' future months. Shared by the overview and the statements and
 * remembered on this device; falls back to the base case when the chosen scenario no longer exists.
 */
export function useReportScenario() {
  const { scenarios, base } = useScenarios();
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    try {
      setChosen(localStorage.getItem(REPORT_SCENARIO));
    } catch {
      // Storage can be blocked; the base case is a fine default.
    }
  }, []);
  const selected = scenarios?.find((s) => s.id === chosen) ?? base;
  const select = (id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(REPORT_SCENARIO, id);
    } catch {
      // Not remembered, but still applied for this visit.
    }
  };
  const options = (scenarios ?? []).map((s) => ({ id: s.id as string, name: s.name, base: s.isBase, active: s.id === selected?.id }));
  return { scenarios, base, selected, select, options, name: selected?.name ?? "Base case" };
}
