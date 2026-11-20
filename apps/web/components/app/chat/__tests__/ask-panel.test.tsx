// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: () => undefined, useMutation: () => vi.fn(), useAction: () => vi.fn(), useConvex: () => ({}) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/overview", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/app/chat/useChatStream", () => ({ useChatStream: () => ({ live: null, send: vi.fn(), stop: vi.fn(), reset: vi.fn() }) }));
const { AskLedgerline } = await import("@/components/app/chat/AskLedgerline");

const waitFrames = () => act(() => new Promise((r) => setTimeout(r, 600)));

test("the pill opens a modal panel named Ask Ledgerline; Escape closes it and focus goes back to the pill", async () => {
  render(<AskLedgerline />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Ask Ledgerline/ }));
  await act(() => settle());
  const panel = screen.getByRole("dialog", { name: "Ask Ledgerline" });
  expect(panel.getAttribute("aria-modal")).toBe("true");
  expect(panel.contains(document.activeElement)).toBe(true);

  await user.keyboard("{Escape}");
  await waitFrames();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /Ask Ledgerline/ }));
});

test("Ctrl+J opens and closes the panel", async () => {
  render(<AskLedgerline />);
  const user = userEvent.setup();
  await user.keyboard("{Control>}j{/Control}");
  await act(() => settle());
  expect(screen.getByRole("dialog", { name: "Ask Ledgerline" })).toBeTruthy();
  await user.keyboard("{Control>}j{/Control}");
  await waitFrames();
  expect(screen.queryByRole("dialog")).toBeNull();
});
