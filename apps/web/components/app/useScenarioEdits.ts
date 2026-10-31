"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { withOverride, withPlanItems } from "@/lib/scenarioEdits";

/**
 * Change one driver in a scenario. The screen shows the change at once: the scenario as the forecast page reads
 * it is updated locally while the mutation is on its way, and replaced by the server's answer when it lands.
 */
export function useSetOverride() {
  return useMutation(api.scenarios.setOverride).withOptimisticUpdate((store, { id, key, value }) => {
    const current = store.getQuery(api.scenarios.get, { id });
    if (current) store.setQuery(api.scenarios.get, { id }, withOverride(current, key, value));
  });
}

/** Replace a scenario's own hires, one-offs or financing, shown at once in the same way. */
export function useSetPlanItems() {
  return useMutation(api.scenarios.setPlanItems).withOptimisticUpdate((store, { id, ...items }) => {
    const current = store.getQuery(api.scenarios.get, { id });
    if (current) store.setQuery(api.scenarios.get, { id }, withPlanItems(current, items));
  });
}
