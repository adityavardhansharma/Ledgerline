// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;
const { ChatDemo } = await import("@/components/landing/AiShowcase");

test("the example questions are named tabs; arrow keys pick another question", async () => {
  render(<ChatDemo />);
  const list = screen.getByRole("tablist", { name: "Example questions" });
  expect(list.tagName).toBe("OL");
  const tabs = screen.getAllByRole("tab");
  expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
  const user = userEvent.setup();
  tabs[0].focus();
  await user.keyboard("{ArrowDown}");
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  await user.click(tabs[2]);
  expect(tabs[2].getAttribute("aria-selected")).toBe("true");
});
