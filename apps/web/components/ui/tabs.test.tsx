// @vitest-environment jsdom
import { Tabs } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { useState } from "react";
import { expect, test, vi } from "vitest";

const agent = createAgent();
const STATEMENTS = [
  { id: "pnl", label: "Profit and loss" },
  { id: "bs", label: "Balance sheet", count: 3 },
  { id: "cf", label: "Cash flow" },
];

test("the tab list is named, has one Tab stop, and arrow keys select tabs", async () => {
  const onChange = vi.fn();
  render(<Tabs label="Statement" tabs={STATEMENTS} onChange={onChange} />);
  expect(screen.getByRole("tablist", { name: "Statement" })).toBeTruthy();
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  expect(tabs[0].getAttribute("aria-selected")).toBe("true");

  const user = userEvent.setup();
  await user.tab();
  await user.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith("bs");
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Balance sheet/ }));
  await user.keyboard("{End}");
  expect(onChange).toHaveBeenLastCalledWith("cf");
});

test("an agent can pick a tab by its text in a controlled strip", async () => {
  function Statement() {
    const [tab, setTab] = useState("pnl");
    return <Tabs label="Statement" value={tab} onChange={setTab} tabs={STATEMENTS} />;
  }
  render(<Statement />);
  const result = await agent.act({ steps: [{ ref: "Statement", action: "select", args: ["cf"] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByRole("tab", { name: "Cash flow" }).getAttribute("aria-selected")).toBe("true");
});
