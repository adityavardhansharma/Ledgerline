// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: () => ({ months: [{ cash: 1_000_00 }, { cash: 2_000_00 }], cashOutPeriod: null }) }));
const { ScenarioRow } = await import("@/components/app/ScenarioRow");

const scenario = (over: object) => ({ id: "s1", name: "Hire two fitters", isBase: false, parentName: "Base case", changes: 2, summary: { lowestCash: 50_000_00, endCash: 80_000_00, runwayMonths: null }, ...over }) as never;
const agent = createAgent();

test("a branch row's name is a button that picks it for comparison, from the keyboard too", async () => {
  const onCompare = vi.fn();
  render(<div role="list"><ScenarioRow scenario={scenario({})} comparing={false} onCompare={onCompare} onOpen={() => {}} /></div>);
  const pick = screen.getByRole("button", { name: "Compare with Hire two fitters" });
  expect(pick.getAttribute("aria-pressed")).toBe("false");
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(pick);
  await user.keyboard("{Enter}");
  expect(onCompare).toHaveBeenCalledTimes(1);
  await user.click(screen.getByText("24+ mo"));
  expect(onCompare).toHaveBeenCalledTimes(2);
});

test("the base row can't be picked, and its menu offers no delete", async () => {
  render(<div role="list"><ScenarioRow scenario={scenario({ id: "b", name: "Base case", isBase: true })} comparing={false} onOpen={() => {}} /></div>);
  expect(screen.queryByRole("button", { name: /Compare with/ })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Actions for Base case" }));
  await act(() => settle());
  expect(screen.getByRole("menuitem", { name: "Open in forecast" })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: "Delete scenario" })).toBeNull();
});

test("an agent can compare a scenario, open its actions and open it, but deleting needs a person", async () => {
  const onCompare = vi.fn();
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  render(<div role="list"><ScenarioRow scenario={scenario({})} comparing onCompare={onCompare} onOpen={onOpen} onDelete={onDelete} /></div>);
  expect(screen.getByRole("button", { name: "Compare with Hire two fitters" }).getAttribute("aria-pressed")).toBe("true");
  const result = await agent.act({
    steps: [
      { ref: "Compare with Hire two fitters", action: "press" },
      { ref: "Actions for Hire two fitters", action: "press", args: ["Open in forecast"] },
    ],
  });
  expect(result.ok, result.error?.message).toBe(true);
  expect(onCompare).toHaveBeenCalled();
  expect(onOpen).toHaveBeenCalledOnce();
  expect((await agent.act({ steps: [{ ref: "Actions for Hire two fitters", action: "press", args: ["Delete scenario"] }] })).ok).toBe(false);
  expect(onDelete).not.toHaveBeenCalled();
});
