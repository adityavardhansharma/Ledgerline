// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { Sections } from "@/components/app/PlanItems";

function Drivers() {
  const [tab, setTab] = useState("assumptions");
  return (
    <>
      <Sections value={tab} onChange={setTab} items={[{ id: "assumptions", label: "Assumptions", count: 2 }, { id: "hires", label: "Hires", count: 0 }, { id: "financing", label: "Financing", count: 1 }]} />
      <output aria-label="Showing">{tab}</output>
    </>
  );
}

test("the forecast's sections are named tabs with one Tab stop that arrow keys move between", async () => {
  render(<Drivers />);
  expect(screen.getByRole("tablist", { name: "Forecast sections" })).toBeTruthy();
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: /Assumptions/ }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("status", { name: "Showing" }).textContent).toBe("hires");
  await user.keyboard("{End}");
  expect(screen.getByRole("status", { name: "Showing" }).textContent).toBe("financing");
  expect(screen.getByRole("tab", { name: /Financing/ }).getAttribute("aria-selected")).toBe("true");
});
