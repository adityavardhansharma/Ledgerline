// @vitest-environment jsdom
import { Button } from "@ledgerline/ui";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

test("design system components render in jsdom", () => {
  render(<Button>Save</Button>);
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
});
