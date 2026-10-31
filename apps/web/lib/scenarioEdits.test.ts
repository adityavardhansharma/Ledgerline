import { describe, expect, it } from "vitest";
import { withOverride, type ScenarioView } from "./scenarioEdits";

const branch = {
  id: "s2",
  name: "Slower payers",
  isBase: false,
  parentName: "Base case",
  own: { overrides: { debtorDays: 60 }, hires: [], oneOffs: [], financing: [] },
  inherited: { growth: 0.02 },
  overrides: { growth: 0.02, debtorDays: 60 },
  hires: [],
  oneOffs: [],
  financing: [],
} as unknown as ScenarioView;

describe("optimistic driver edits", () => {
  it("sets a driver on the scenario itself", () => {
    const next = withOverride(branch, "growth", 0.05);
    expect(next.own.overrides).toEqual({ debtorDays: 60, growth: 0.05 });
    expect(next.overrides).toEqual({ growth: 0.05, debtorDays: 60 });
    expect(next.inherited).toEqual({ growth: 0.02 });
  });

  it("resets to the parent's value, or to the actuals when the parent doesn't set it", () => {
    const changed = withOverride(branch, "growth", 0.05);
    expect(withOverride(changed, "growth", null).overrides.growth).toBe(0.02);
    const reset = withOverride(branch, "debtorDays", null);
    expect(reset.own.overrides).toEqual({});
    expect("debtorDays" in reset.overrides).toBe(false);
  });
});
