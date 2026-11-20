// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

const rename = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("convex/react", () => ({
  useAction: () => async () => ({ names: ["Two fitters from March", "Slower debtors"] }),
  useMutation: () => rename,
}));
const { NameSuggest } = await import("@/components/app/ai/Planners");

test("suggested names open beside the button, a pick renames the scenario, and Escape dismisses them", async () => {
  render(<NameSuggest scenarioId={"s1" as never} current="Copy of Base case" />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Suggest a name/ }));
  await act(() => settle());
  const list = screen.getByRole("dialog", { name: "Suggested names" });
  expect(list.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(screen.queryByRole("dialog")).toBeNull();

  await user.click(screen.getByRole("button", { name: /Suggest a name/ }));
  await act(() => settle());
  await user.click(screen.getByRole("button", { name: "Slower debtors" }));
  await act(() => settle());
  expect(rename).toHaveBeenCalledWith({ id: "s1", name: "Slower debtors" });
  expect(screen.queryByRole("dialog")).toBeNull();
});
