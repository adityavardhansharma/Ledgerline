// @vitest-environment jsdom
import { Tooltip } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test } from "vitest";

test("text becomes an info button that opens on focus, is described by the tip and closes on Escape", async () => {
  render(<Tooltip content="Cash in the bank, today">Cash</Tooltip>);
  const tip = screen.getByRole("tooltip", { hidden: true });
  const trigger = screen.getByRole("button", { name: "Cash" });
  expect(tip.hasAttribute("data-open")).toBe(false);

  const user = userEvent.setup();
  await user.tab();
  await act(() => settle());
  expect(document.activeElement).toBe(trigger);
  expect(tip.hasAttribute("data-open")).toBe(true);
  expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(tip.hasAttribute("data-open")).toBe(false);
});

test("an element child is the trigger itself, and open shows the tip without any interaction", async () => {
  render(<Tooltip content="Matches Xero to the cent" open><button type="button">Matched</button></Tooltip>);
  await act(() => settle());
  const tip = screen.getByRole("tooltip");
  expect(tip.hasAttribute("data-open")).toBe(true);
  expect(screen.getByRole("button", { name: "Matched" }).getAttribute("aria-describedby")).toBe(tip.id);
});
