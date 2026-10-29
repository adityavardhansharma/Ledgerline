import { expect, test } from "vitest";
import { bridgeLede, cashLede, everyDay, overviewLede } from "./views";
import type { ForecastRun, Snapshot } from "./types";

test("everyDay fills the whole window so the calendar keeps its dates in place", () => {
  const days = everyDay([{ date: "2026-08-03", valueCents: 12_000 }, { date: "2026-09-30", valueCents: -500 }], "2026-08", "2026-09");
  expect(days).toHaveLength(61);
  expect(days[0]).toEqual({ date: "2026-08-01", value: 0 });
  expect(days[2]).toEqual({ date: "2026-08-03", value: 120 });
  expect(days.at(-1)).toEqual({ date: "2026-09-30", value: -5 });
});

const snap = (over: Partial<Snapshot["measures"]> = {}, bridge: Snapshot["bridge"] = []) =>
  ({ asOf: "2026-09", bridge, measures: { cash: 41_230_000, cashDelta: -0.066, revenue: 22_890_000, revenueDelta: 0.158, ...over } }) as unknown as Snapshot;
const run = (over: Partial<ForecastRun> = {}) => ({ cashOutPeriod: null, lowestCash: 5_950_000, lowestCashPeriod: "2027-09", ...over }) as ForecastRun;

test("overviewLede answers first: cash, the month's sales, how long cash lasts", () => {
  expect(overviewLede(snap(), run(), "the base case")).toBe(
    "Cash is €412,300, down 6.6% on last month, and September sales were up 15.8%. On the base case it lasts the whole forecast.",
  );
  expect(overviewLede(snap(), run({ cashOutPeriod: "2027-03" }), "“Hire two”")).toMatch(/On “Hire two” it runs out in Mar 2027\.$/);
  expect(overviewLede(snap({ cashDelta: null, revenueDelta: null }), null, "the base case")).toBe("Cash is €412,300. September sales were €228,900.");
});

test("cashLede names the low point", () => {
  expect(cashLede(run(), "the base case")).toBe("Through the whole forecast, on the base case. Lowest point €59,500 in Sep 2027.");
  expect(cashLede(undefined, "the base case")).toBe("Building the forecast…");
});

test("bridgeLede picks the biggest mover, in or out", () => {
  const bridge = [
    { label: "Opening cash", value: 44_130_000, kind: "start" as const },
    { label: "Net profit", value: 2_108_700 },
    { label: "Trade debtors", value: -3_840_000 },
    { label: "Closing cash", value: 41_230_000, kind: "end" as const },
  ];
  expect(bridgeLede(snap({}, bridge))).toBe("Cash fell €29,000. Trade debtors moved it most: −€38,400.");
  expect(bridgeLede(snap({}, []))).toBeNull();
});
