"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
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
