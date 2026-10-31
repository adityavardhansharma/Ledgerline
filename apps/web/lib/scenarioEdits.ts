import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

/** A scenario as the forecast page reads it (api.scenarios.get). */
export type ScenarioView = NonNullable<FunctionReturnType<typeof api.scenarios.get>>;

/** The scenario after one driver changes (null: back to the parent's value), as scenarios.setOverride leaves it. */
export function withOverride(current: ScenarioView, key: string, value: number | null): ScenarioView {
  const own = { ...current.own.overrides };
  const overrides = { ...current.overrides };
  if (value === null) {
    delete own[key];
    // Back to what the parent scenario says, or to the actuals when no parent sets it.
    if (key in current.inherited) overrides[key] = current.inherited[key];
    else delete overrides[key];
  } else {
    own[key] = value;
    overrides[key] = value;
  }
  return { ...current, own: { ...current.own, overrides: own }, overrides };
}
