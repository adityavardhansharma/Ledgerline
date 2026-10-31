import { describe, expect, it } from "vitest";
import { withOverride, withPlanItems, type ScenarioView } from "./scenarioEdits";

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

describe("optimistic plan items", () => {
  const hire = (id: string, role: string) => ({ id, role, salaryCents: 4_000_000, startPeriod: "2026-11", count: 1 });
  const withHires = { ...branch, own: { ...branch.own, hires: [hire("b1", "Joiner")] }, hires: [hire("p1", "Foreman"), hire("b1", "Joiner")] } as ScenarioView;

  it("keeps inherited items first and replaces the scenario's own", () => {
    const next = withPlanItems(withHires, { hires: [hire("b1", "Joiner"), hire("b2", "Apprentice")] });
    expect(next.own.hires.map((h) => h.id)).toEqual(["b1", "b2"]);
    expect(next.hires.map((h) => h.id)).toEqual(["p1", "b1", "b2"]);
    expect(withPlanItems(withHires, { hires: [] }).hires.map((h) => h.id)).toEqual(["p1"]);
  });

  it("leaves the other lists alone", () => {
    const next = withPlanItems(withHires, { oneOffs: [{ id: "o1", label: "Van", period: "2026-12", amountCents: 3_000_000, kind: "capex" }] });
    expect(next.hires).toBe(withHires.hires);
    expect(next.oneOffs.map((o) => o.id)).toEqual(["o1"]);
  });
});
