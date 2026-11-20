// @vitest-environment jsdom
import { AssumptionField } from "@ledgerline/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

test("the slider and the number box move together, and a change from the base is marked", async () => {
  const onChange = vi.fn();
  const { container } = render(<AssumptionField id="wi-fitters" label="Fitters hired" min={0} max={10} unit="people" defaultValue={0} base={0} onChange={onChange} />);
  const thumb = screen.getByRole("slider", { name: "Fitters hired" });
  const box = screen.getByLabelText<HTMLInputElement>("Fitters hired", { selector: "input[type=text]" });
  expect(container.querySelector(".ll-assume")?.classList.contains("is-changed")).toBe(false);

  thumb.focus();
  await userEvent.setup().keyboard("{ArrowRight}{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith(2);
  expect(box.value).toBe("2");
  expect(container.querySelector(".ll-assume")?.classList.contains("is-changed")).toBe(true);

  fireEvent.change(box, { target: { value: "7" } });
  expect(onChange).toHaveBeenLastCalledWith(7);
  expect(thumb.getAttribute("aria-valuenow") ?? (thumb as HTMLInputElement).value).toBe("7");
});
