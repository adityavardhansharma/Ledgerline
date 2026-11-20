// @vitest-environment jsdom
import { Checkbox } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

test("the label names the checkbox, and Space and clicks on the label toggle it", async () => {
  const onChange = vi.fn();
  render(<Checkbox id="fc" label="Include forecast months" defaultChecked onChange={onChange} />);
  const box = screen.getByRole("checkbox", { name: "Include forecast months" });
  expect(box.getAttribute("aria-checked")).toBe("true");

  const user = userEvent.setup();
  box.focus();
  await user.keyboard(" ");
  expect(onChange).toHaveBeenLastCalledWith(false);
  await user.click(screen.getByText("Include forecast months"));
  expect(onChange).toHaveBeenLastCalledWith(true);
});

test("a controlled checkbox stays as its checked prop says", async () => {
  render(<Checkbox id="lock" label="Locked" checked={false} />);
  await userEvent.setup().click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
});
