// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
const { BoardCommentary } = await import("@/components/app/BoardCommentary");

const commentary = {
  status: "final",
  sections: { summary: [["Revenue rose ", { text: "8%", source: "P&L · Sep", fact: "f1" }, "."]] },
  facts: [{ id: "f1", label: "Revenue growth", value: "8%", source: "P&L · Sep" }],
} as never;

test("the cited figures open and close from their toggle, which says whether they're shown", async () => {
  render(<BoardCommentary commentary={commentary} busy={null} onRedraft={() => {}} />);
  const toggle = screen.getByRole("button", { name: /Every figure cited \(1\)/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Revenue growth")).toBeNull();
  await userEvent.setup().click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.getElementById(toggle.getAttribute("aria-controls")!)?.tagName).toBe("TABLE");
  expect(screen.getByText("Revenue growth")).toBeTruthy();
});
