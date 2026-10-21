"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ForecastRun } from "@/lib/types";

/** The newest forecast for a scenario; asks the engine for a fresh run when inputs or actuals changed. */
export function useForecast(scenarioId: Id<"scenarios"> | undefined, dependency: unknown = null) {
  const latest = useQuery(api.forecast.latest, scenarioId ? { scenarioId } : "skip") as ForecastRun | null | undefined;
  const run = useAction(api.forecast.run);
  const asked = useRef<string>("");
  useEffect(() => {
    if (!scenarioId) return;
    const key = `${scenarioId}:${JSON.stringify(dependency)}`;
    if (asked.current === key) return;
    asked.current = key;
    const timer = setTimeout(() => void run({ scenarioId }).catch(() => undefined), 250);
    return () => clearTimeout(timer);
  }, [scenarioId, dependency, run]);
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
