// @vitest-environment jsdom
import { SegmentedControl } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { useState } from "react";
import { expect, test, vi } from "vitest";

const agent = createAgent();
const PERIODS = [
  { value: "m", label: "Monthly" },
  { value: "q", label: "Quarterly" },
];

test("one Tab stop, arrow keys pick the next option, and the label names the group", async () => {
  const onChange = vi.fn();
  render(<SegmentedControl label="Period" defaultValue="m" options={PERIODS} onChange={onChange} />);
  expect(screen.getByRole("radiogroup", { name: "Period" })).toBeTruthy();
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Monthly" }));
  await user.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith("q");
  expect(screen.getByRole("radio", { name: "Quarterly" }).getAttribute("aria-checked")).toBe("true");
  await user.tab();
  expect(document.activeElement).toBe(document.body);
});

test("an agent can switch a controlled control by the option's name", async () => {
  function Period() {
    const [view, setView] = useState("m");
    return <SegmentedControl label="Period" value={view} onChange={setView} options={PERIODS} />;
  }
  render(<Period />);
  const result = await agent.act({ steps: [{ ref: "Period", action: "setValue", args: ["q"] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByRole("radio", { name: "Quarterly" }).getAttribute("aria-checked")).toBe("true");
});
