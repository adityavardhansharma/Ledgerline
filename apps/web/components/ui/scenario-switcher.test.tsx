// @vitest-environment jsdom
import { ScenarioSwitcher } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

const OPTIONS = [
  { id: "base", name: "Base case", base: true },
  { id: "hire", name: "Hire two fitters", active: true },
];

test("the switcher opens a menu of scenarios with the shown one checked, and picking one selects it", async () => {
  const onSelect = vi.fn();
  render(<ScenarioSwitcher name="Hire two fitters" options={OPTIONS} onSelect={onSelect} />);
  const trigger = screen.getByRole("button", { name: /Hire two fitters/ });
  const user = userEvent.setup();
  await user.click(trigger);
  await act(() => settle());
  expect(screen.getByRole("menu", { name: /Hire two fitters/ })).toBeTruthy();
  expect(screen.getByRole("menuitemradio", { name: "Hire two fitters" }).getAttribute("aria-checked")).toBe("true");
  await user.click(screen.getByRole("menuitemradio", { name: "Base case" }));
  await act(() => settle());
  expect(onSelect).toHaveBeenCalledWith("base");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("with one scenario there's nothing to switch to, and with none the button is disabled", () => {
  const { rerender } = render(<ScenarioSwitcher name="Base case" options={[OPTIONS[0]]} />);
  expect(screen.getByRole("button").getAttribute("aria-haspopup")).toBeNull();
  rerender(<ScenarioSwitcher name="Base case" options={[]} />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
});
