// @vitest-environment jsdom
import { Slider } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { expect, test, vi } from "vitest";

const agent = createAgent();

test("the label names the slider, arrow keys step it and the value reads formatted", async () => {
  const onChange = vi.fn();
  render(<Slider id="growth" label="Growth a month" min={0} max={10} defaultValue={3} format={(v) => `${v}%`} onChange={onChange} />);
  const thumb = screen.getByRole("slider", { name: "Growth a month" });
  expect(thumb.getAttribute("aria-valuetext")).toBe("3%");
  expect(screen.getByText("3%", { selector: ".ll-slider-value" })).toBeTruthy();

  const user = userEvent.setup();
  thumb.focus();
  await user.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith(4);
  await user.keyboard("{Home}");
  expect(onChange).toHaveBeenLastCalledWith(0);
});

test("without a format the value shows as a plain number, and an agent can set it", async () => {
  render(<Slider id="hires" label="Fitters hired" min={0} max={2000} step={100} defaultValue={1200} />);
  expect(screen.getByText("1200", { selector: ".ll-slider-value" })).toBeTruthy();
  const result = await agent.act({ steps: [{ ref: "Fitters hired", action: "setValue", args: [1500] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(screen.getByText("1500", { selector: ".ll-slider-value" })).toBeTruthy();
});
