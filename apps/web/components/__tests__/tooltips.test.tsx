// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { settle } from "@ui-sdk/core/testing";
import { expect, test } from "vitest";
import { Tooltips } from "@/components/Tooltips";

const pause = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

test("hovering anything with a title shows it in one shared tooltip, label first, and Escape hides it", async () => {
  render(
    <>
      <Tooltips />
      <button type="button" title="Runway · Months of cash at the current burn">14.2 mo</button>
      <button type="button" title="Search everything again" />
    </>,
  );
  const runway = screen.getByRole("button", { name: "14.2 mo" });
  fireEvent.mouseOver(runway);
  await pause(400);
  await act(() => settle());
  const tip = screen.getByRole("tooltip");
  expect(tip.hasAttribute("data-open")).toBe(true);
  expect(tip.querySelector("b")?.textContent).toBe("Runway");
  expect(tip.querySelector("span")?.textContent).toBe("Months of cash at the current burn");
  expect(runway.hasAttribute("title")).toBe(false);

  fireEvent.keyDown(window, { key: "Escape" });
  await act(() => settle());
  expect(tip.hasAttribute("data-open")).toBe(false);

  const icon = screen.getByRole("button", { name: "Search everything again" });
  fireEvent.mouseOver(icon);
  await pause(400);
  expect(icon.hasAttribute("title")).toBe(false);
  expect(screen.getByRole("button", { name: "Search everything again" })).toBe(icon);
});
