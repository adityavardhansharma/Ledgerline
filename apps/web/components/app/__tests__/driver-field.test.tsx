// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { expect, test, vi } from "vitest";
import { DriverField } from "@/components/app/DriverField";

const agent = createAgent();

test("the slider and the value box are both named for the driver and move together, within its range", async () => {
  const onChange = vi.fn();
  render(<DriverField id="driver-growth" label="Revenue growth" unit="%" min={-10} max={10} step={0.5} value={2.5} help="A month" onChange={onChange} />);
  const thumb = screen.getByRole("slider", { name: "Adjust Revenue growth" });
  const box = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Revenue growth" });
  expect(thumb.getAttribute("aria-valuetext")).toBe("2.5%");
  const user = userEvent.setup();
  thumb.focus();
  await user.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith(3);
  expect(box.value).toBe("3");
  await user.tripleClick(box);
  await user.keyboard("40");
  expect(onChange).toHaveBeenLastCalledWith(10);
});

test("a read-only driver can't be dragged or typed, and an agent can set an editable one", async () => {
  const { rerender } = render(<DriverField id="d" label="Debtor days" unit="days" min={0} max={120} step={1} value={48} help="" readOnly onChange={() => {}} />);
  expect(screen.getByRole("slider", { name: "Adjust Debtor days" }).hasAttribute("disabled")).toBe(true);
  const onChange = vi.fn();
  rerender(<DriverField id="d" label="Debtor days" unit="days" min={0} max={120} step={1} value={48} parent={40} help="" onChange={onChange} onReset={() => {}} />);
  const result = await agent.act({ steps: [{ ref: "Adjust Debtor days", action: "setValue", args: [60] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith(60);
  expect(screen.getByText("Was 40 days")).toBeTruthy();
});
