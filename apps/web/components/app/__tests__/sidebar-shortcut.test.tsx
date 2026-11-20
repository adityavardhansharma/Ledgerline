// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({}));
vi.mock("convex/react", () => ({ useAction: () => vi.fn(), useQuery: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
const { useCollapsed } = await import("@/components/app/AppPage");

function Shell() {
  const [collapsed] = useCollapsed();
  return (
    <>
      <output aria-label="Sidebar">{collapsed ? "icons" : "full"}</output>
      <input aria-label="Search the ledger" />
    </>
  );
}

test("[ collapses and expands the sidebar, but types normally in a text field", async () => {
  render(<Shell />);
  const state = screen.getByRole("status", { name: "Sidebar" });
  const user = userEvent.setup();
  await user.keyboard("[[");
  expect(state.textContent).toBe("icons");
  await user.keyboard("[[");
  expect(state.textContent).toBe("full");
  await user.click(screen.getByRole("textbox"));
  await user.keyboard("[[");
  expect(state.textContent).toBe("full");
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("[");
});
