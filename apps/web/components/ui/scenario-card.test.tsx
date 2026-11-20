// @vitest-environment jsdom
import { ScenarioCard } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const CARD = { name: "Hire two fitters", parent: "Base case", changes: 2, runway: 14.2, cash: 120000, ebitda: 40000 };

test("a selectable card is one Tab stop that Enter, Space and clicks select, and says whether it's chosen", async () => {
  const onSelect = vi.fn();
  render(<ScenarioCard {...CARD} onSelect={onSelect} />);
  const card = screen.getByRole("button", { name: /Hire two fitters/ });
  expect(card.getAttribute("aria-pressed")).toBe("false");
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(card);
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  await user.click(card);
  expect(onSelect).toHaveBeenCalledTimes(3);
});

test("a card without onSelect is plain content", () => {
  render(<ScenarioCard {...CARD} active />);
  expect(screen.queryByRole("button")).toBeNull();
});
