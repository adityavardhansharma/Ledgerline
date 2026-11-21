// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

const branch = vi.hoisted(() => vi.fn());
vi.mock("convex-helpers/react/cache", () => ({ useQuery: () => ({ lines: [{ date: "2026-09-04", journalNumber: 812, code: "200", account: "Sales", contact: "Coyle Builders", description: "Kitchen fit-out", debitCents: 0, creditCents: 1_250_00 }] }) }));
vi.mock("convex/react", () => ({
  useMutation: () => branch,
  useAction: () => vi.fn(async () => null),
  useQuery: () => ({ lines: [{ date: "2026-09-04", journalNumber: 812, code: "200", account: "Sales", contact: "Coyle Builders", description: "Kitchen fit-out", debitCents: 0, creditCents: 1_250_00 }] }),
}));
vi.mock("@/components/app/useWorkspace", () => ({ useWorkspace: () => ({ org: { source: "xero" }, connection: { mode: "journals" } }) }));
vi.mock("@/components/app/ai/Explainers", () => ({ ExplainFigure: () => null }));
const { BranchDialog } = await import("@/components/app/BranchDialog");
const { DrillDrawer } = await import("@/components/app/DrillDrawer");

test("branching: the name field takes focus and Enter branches", async () => {
  const onCreated = vi.fn();
  branch.mockResolvedValueOnce("new-id");
  render(<BranchDialog fromId={"b" as never} fromName="Base case" onClose={() => {}} onCreated={onCreated} />);
  await act(() => settle());
  const name = screen.getByRole("textbox", { name: "Scenario name" });
  expect(screen.getByRole("dialog", { name: "Branch Base case" })).toBeTruthy();
  expect(document.activeElement).toBe(name);
  expect((screen.getByRole("button", { name: /Branch scenario/ }) as HTMLButtonElement).disabled).toBe(true);
  const user = userEvent.setup();
  await user.type(name, "Hire two fitters{Enter}");
  expect(branch).toHaveBeenCalledWith({ fromId: "b", name: "Hire two fitters" });
  expect(onCreated).toHaveBeenCalledWith("new-id");
});

test("branching: a failure shows on the name field and marks it invalid", async () => {
  branch.mockRejectedValueOnce(new Error("A scenario with that name exists."));
  render(<BranchDialog fromId={"b" as never} fromName="Base case" onClose={() => {}} onCreated={() => {}} />);
  await act(() => settle());
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Scenario name" }), "Base case");
  await user.click(screen.getByRole("button", { name: /Branch scenario/ }));
  await act(() => settle());
  expect(screen.getByRole("textbox", { name: "Scenario name" }).getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText(/Couldn't branch|exists/)).toBeTruthy();
});

test("branching: Cancel and Escape close without branching", async () => {
  const onClose = vi.fn();
  branch.mockClear();
  render(<BranchDialog fromId={"b" as never} fromName="Base case" onClose={onClose} onCreated={() => {}} />);
  await act(() => settle());
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(branch).not.toHaveBeenCalled();
});

test("drilling into a figure opens a drawer of its journal lines that Escape closes", async () => {
  const onClose = vi.fn();
  render(<DrillDrawer target={{ accountId: "a", label: "Sales", code: "200", period: "2026-09", value: -1250 }} onClose={onClose} />);
  await act(() => settle());
  const drawer = screen.getByRole("dialog", { name: /from 1 journal line/ });
  expect(drawer.getAttribute("aria-modal")).toBe("true");
  expect(screen.getByText("Kitchen fit-out")).toBeTruthy();
  await userEvent.setup().keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});
