import { expect, test } from "vitest";
import { everyDay } from "./views";

test("everyDay fills the whole window so the calendar keeps its dates in place", () => {
  const days = everyDay([{ date: "2026-08-03", valueCents: 12_000 }, { date: "2026-09-30", valueCents: -500 }], "2026-08", "2026-09");
  expect(days).toHaveLength(61);
  expect(days[0]).toEqual({ date: "2026-08-01", value: 0 });
  expect(days[2]).toEqual({ date: "2026-08-03", value: 120 });
  expect(days.at(-1)).toEqual({ date: "2026-09-30", value: -5 });
});
