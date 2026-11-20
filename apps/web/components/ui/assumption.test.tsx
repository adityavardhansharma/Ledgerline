// @vitest-environment jsdom
import { AssumptionField } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

test("the slider and the number box move together, and a change from the base is marked", async () => {
  const onChange = vi.fn();
  const { container } = render(<AssumptionField id="wi-fitters" label="Fitters hired" min={0} max={10} unit="people" defaultValue={0} base={0} onChange={onChange} />);
  const thumb = screen.getByRole("slider", { name: "Fitters hired" });
  const box = screen.getByRole<HTMLInputElement>("textbox", { name: "Fitters hired" });
  expect(container.querySelector(".ll-assume")?.classList.contains("is-changed")).toBe(false);

  const user = userEvent.setup();
  thumb.focus();
  await user.keyboard("{ArrowRight}{ArrowRight}");
  expect(onChange).toHaveBeenLastCalledWith(2);
  expect(box.value).toBe("2");
  expect(container.querySelector(".ll-assume")?.classList.contains("is-changed")).toBe(true);

  await user.tripleClick(box);
  await user.keyboard("7");
  expect(onChange).toHaveBeenLastCalledWith(7);
  expect(thumb.getAttribute("aria-valuenow") ?? (thumb as HTMLInputElement).value).toBe("7");
});
