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

type Items = { hires?: ScenarioView["hires"]; oneOffs?: ScenarioView["oneOffs"]; financing?: ScenarioView["financing"] };

/**
 * The scenario after its own hires, one-offs or financing are replaced, as scenarios.setPlanItems leaves it. The
 * resolved lists keep what the scenario inherits first, then its own items, as the server resolves them.
 */
export function withPlanItems(current: ScenarioView, items: Items): ScenarioView {
  const next = { ...current, own: { ...current.own } };
  const replace = <K extends keyof Items>(kind: K) => {
    const mine = items[kind];
    if (!mine) return;
    const ownIds = new Set(current.own[kind].map((item) => item.id));
    const inherited = current[kind].filter((item) => !ownIds.has(item.id));
    (next.own[kind] as Items[K]) = mine;
    (next[kind] as Items[K]) = [...inherited, ...mine] as Items[K];
  };
  replace("hires");
  replace("oneOffs");
  replace("financing");
  return next;
}
