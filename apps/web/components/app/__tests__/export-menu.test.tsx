// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { expect, test, vi } from "vitest";

const download = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useConvex: () => ({}) }));
vi.mock("@/components/app/useWorkspace", () => ({ useWorkspace: () => ({ org: { name: "Kestrel Joinery Ltd", asOf: "2026-09" } }) }));
vi.mock("@/lib/csv", async (load) => ({ ...(await load<typeof import("@/lib/csv")>()), downloadCsvText: download }));

const { ExportMenu } = await import("@/components/app/ExportMenu");

test("Export opens a menu of files, and a choice downloads it and closes the menu", async () => {
  const build = vi.fn(() => "Account,Sep\nSales,1250\n");
  render(<ExportMenu title="Profit and loss" html={false} csv={[{ label: "Profit and loss", build }]} />);
  const trigger = screen.getByRole("button", { name: "Export" });
  const user = userEvent.setup();
  await user.click(trigger);
  await act(() => settle());
  expect(screen.getByRole("group", { name: "Spreadsheet (CSV)" })).toBeTruthy();
  await user.click(screen.getByRole("menuitem", { name: "Profit and loss" }));
  await act(() => settle());
  expect(build).toHaveBeenCalledOnce();
  expect(download).toHaveBeenCalledWith("kestrel-joinery-ltd-profit-and-loss-2026-09", "Account,Sep\nSales,1250\n");
  expect(screen.queryByRole("menu")).toBeNull();
});

test("nothing to export shows the error, and a disabled Export doesn't open", async () => {
  const { rerender } = render(<ExportMenu title="Ledger" html={false} csv={[{ label: "Journals", build: () => null }]} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Export" }));
  await act(() => settle());
  await user.click(screen.getByRole("menuitem", { name: "Journals" }));
  await act(() => settle());
  expect(screen.getByText("There's nothing to export yet.")).toBeTruthy();
  expect(screen.queryByRole("menu")).toBeNull();

  rerender(<ExportMenu title="Ledger" html={false} disabled csv={[{ label: "Journals", build: () => null }]} />);
  await user.click(screen.getByRole("button", { name: "Export" }));
  expect(screen.queryByRole("menu")).toBeNull();
});
