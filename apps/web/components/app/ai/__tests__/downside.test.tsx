// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

const calls = vi.hoisted(() => ({ branch: vi.fn(async () => "new-id"), setOverride: vi.fn(async () => {}) }));
vi.mock("convex/react", () => {
  let n = 0;
  return {
    useAction: () => async () => ({ baseId: "base", name: "Downside case", changes: [{ key: "debtorDays", from: 48, to: 71, reason: [] }] }),
    useMutation: () => (n++ % 2 === 0 ? calls.branch : calls.setOverride),
  };
});
const { DownsideButton } = await import("@/components/app/ai/Planners");

test("the downside case opens in a dialog named for it; Escape closes it, and Create scenario branches and applies it", async () => {
  const onCreated = vi.fn();
  render(<DownsideButton onCreated={onCreated} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Downside case/ }));
  await act(() => settle());
  expect(screen.getByRole("dialog", { name: "A downside case from your own history" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(screen.queryByRole("dialog")).toBeNull();

  await user.click(screen.getByRole("button", { name: /Downside case/ }));
  await act(() => settle());
  await user.click(screen.getByRole("button", { name: /Create scenario/ }));
  await act(() => settle());
  expect(calls.branch).toHaveBeenCalledWith({ fromId: "base", name: "Downside case" });
  expect(calls.setOverride).toHaveBeenCalledWith({ id: "new-id", key: "debtorDays", value: 71 });
  expect(onCreated).toHaveBeenCalledWith("new-id");
  expect(screen.queryByRole("dialog")).toBeNull();
});
