// @vitest-environment node
import { describe, expect, it } from "vitest";
import { repairProgram, segments } from "./Message";

describe("chat answers", () => {
  it("untangles a Query and a chart that share a name", () => {
    const code = [
      "root = Stack([trading, cash])",
      'cash = Query("monthly_trend", {metric: "cash", months: 3}, {rows: []})',
      'cashChart = LineChart("Cash", cash.rows.label, cash.rows.value, "money")',
      "cash = cashChart",
    ].join("\n");
    expect(repairProgram(code).split("\n")).toEqual([
      "root = Stack([trading, cash])",
      'cashData = Query("monthly_trend", {metric: "cash", months: 3}, {rows: []})',
      'cashChart = LineChart("Cash", cashData.rows.label, cashData.rows.value, "money")',
      "cash = cashChart",
    ]);
  });

  it("leaves a sound program alone", () => {
    const code = 'root = Stack([chart])\nt = Query("monthly_trend", {metric: "revenue"}, {rows: []})\nchart = LineChart("Revenue", t.rows.label, t.rows.value)';
    expect(repairProgram(code)).toBe(code);
  });

  it("splits prose from ui blocks, keeping a block that is still streaming open", () => {
    expect(segments("Hello\n\n```ui\nroot = Stack([a])\n```\n\nBye").map((s) => s.kind)).toEqual(["text", "ui", "text"]);
    expect(segments("Hello\n\n```ui\nroot = Stack([")).toEqual([{ kind: "text", text: "Hello" }, { kind: "ui", code: "root = Stack([", open: true }]);
  });
});
