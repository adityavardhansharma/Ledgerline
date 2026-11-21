// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { useState } from "react";
import { expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/overview", useRouter: () => ({ push: vi.fn() }) }));
const { SourcePicker } = await import("@/components/app/chat/ChatPanel");
const { CHAT_SOURCES } = await import("@/convex/lib/chatSpec");

function Picker() {
  const [value, setValue] = useState<string[]>([]);
  return <SourcePicker value={value} onChange={setValue} />;
}

test("the sources open in a named popover of checkboxes; ticking narrows the search and Escape stays inside", async () => {
  const escapes: boolean[] = [];
  window.addEventListener("keydown", (e) => e.key === "Escape" && escapes.push(e.defaultPrevented));
  render(<Picker />);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: /All sources/ });
  await user.click(trigger);
  await act(() => settle());
  expect(screen.getByRole("dialog", { name: "Look only in" })).toBeTruthy();
  const first = screen.getByRole("checkbox", { name: new RegExp(CHAT_SOURCES[0].label) });
  expect(first.getAttribute("aria-checked")).toBe("false");
  await user.click(first);
  expect(first.getAttribute("aria-checked")).toBe("true");
  expect(trigger.textContent).toContain(CHAT_SOURCES[0].label);
  expect(screen.getByRole("button", { name: "Everything" }).getAttribute("aria-pressed")).toBe("false");

  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(escapes).toEqual([true]);
});
