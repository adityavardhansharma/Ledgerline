// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";
import { AddFinancing, AddHire, AddOneOff } from "@/components/app/PlanItems";

const agent = createAgent();

test("an agent can open the hire form, fill every field by its label and add the hire", async () => {
  const onAdd = vi.fn();
  render(<AddHire start="2026-10" onAdd={onAdd} />);
  const opened = await agent.act({ steps: [{ ref: "Add hire", action: "press" }] });
  expect(opened.ok, opened.error?.message).toBe(true);
  await act(() => settle());
  const result = await agent.act({
    steps: [
      { ref: "Role", action: "setValue", args: ["Cabinet maker"] },
      { ref: "Annual salary", action: "setValue", args: ["45000"] },
      { ref: "People", action: "setValue", args: ["2"] },
      { ref: "Start month", action: "setValue", args: ["2026-12"] },
    ],
  });
  expect(result.ok, result.error?.message).toBe(true);
  await userEvent.setup().click(screen.getByRole("button", { name: "Add hire" }));
  expect(onAdd).toHaveBeenCalledWith({ role: "Cabinet maker", salaryCents: 4_500_000, startPeriod: "2026-12", count: 2 });
});

test("one-offs and financing pick their type from a segmented control, from the keyboard too", async () => {
  const addOneOff = vi.fn();
  const addFinancing = vi.fn();
  render(
    <>
      <AddOneOff start="2026-10" onAdd={addOneOff} />
      <AddFinancing start="2026-10" onAdd={addFinancing} />
    </>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Add one-off" }));
  screen.getByRole("radio", { name: "Equipment" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "Income" }).getAttribute("aria-checked")).toBe("true");
  await user.type(screen.getByRole("textbox", { name: "What" }), "Grant received");
  await user.type(screen.getByRole("textbox", { name: "Amount" }), "12000");
  await user.click(screen.getByRole("button", { name: "Add one-off" }));
  expect(addOneOff).toHaveBeenCalledWith({ label: "Grant received", period: "2026-10", amountCents: 1_200_000, kind: "income" });

  await user.click(screen.getByRole("button", { name: "Add financing" }));
  await user.click(screen.getByRole("radio", { name: "Equity" }));
  await user.type(screen.getByRole("textbox", { name: "Amount" }), "50000");
  await user.click(screen.getByRole("button", { name: "Add financing" }));
  expect(addFinancing).toHaveBeenCalledWith({ period: "2026-10", amountCents: 5_000_000, kind: "equity" });
});
