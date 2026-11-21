// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({ useAction: () => vi.fn(), useMutation: () => vi.fn() }));
const { AnomalyStrip } = await import("@/components/app/ai/Explainers");

const FLAGS = [{ accountId: "a1", name: "Motor expenses", kind: "expense", period: "2026-09", nowCents: 4_200_00, typicalCents: 1_100_00, reason: null }];

test("the strip's heading discloses the reasons, from the keyboard and for an agent", async () => {
  render(<AnomalyStrip flags={FLAGS} />);
  const head = screen.getByRole("button", { name: /1 unusual movement/ });
  expect(head.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Motor expenses")).toBeNull();
  const user = userEvent.setup();
  head.focus();
  await user.keyboard("{Enter}");
  expect(head.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Motor expenses")).toBeTruthy();
  expect(screen.getByText(/hide/)).toBeTruthy();
  await user.keyboard(" ");
  expect(screen.queryByText("Motor expenses")).toBeNull();

  const result = await createAgent().act({ steps: [{ ref: "1 unusual movement", action: "toggle" }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByText("Motor expenses")).toBeTruthy();
});

test("no flags, no strip", () => {
  const { container } = render(<AnomalyStrip flags={[]} />);
  expect(container.innerHTML).toBe("");
});
