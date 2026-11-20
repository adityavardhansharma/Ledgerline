// @vitest-environment jsdom
import { RadioGroup } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

const OPTIONS = [
  { value: "invoices", label: "From invoices", hint: "Exact, if invoices sync" },
  { value: "balances", label: "From balances", hint: "Close enough" },
];

test("the legend names the group, each label its radio, and arrow keys move the choice", async () => {
  const onChange = vi.fn();
  render(<RadioGroup name="debtors" label="Debtor days" options={OPTIONS} onChange={onChange} />);
  const group = screen.getByRole("radiogroup", { name: "Debtor days" });
  expect(group.tagName).toBe("FIELDSET");
  const first = screen.getByRole("radio", { name: "From invoices" });
  expect(first.getAttribute("aria-checked")).toBe("true");

  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(first);
  await user.keyboard("{ArrowDown}");
  expect(onChange).toHaveBeenLastCalledWith("balances");
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "From balances" }));
  await user.click(screen.getByText("Exact, if invoices sync"));
  expect(onChange).toHaveBeenLastCalledWith("invoices");
});
