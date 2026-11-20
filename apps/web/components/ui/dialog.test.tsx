// @vitest-environment jsdom
import { Button, Dialog, Input } from "@ledgerline/ui";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { useState } from "react";
import { expect, test, vi } from "vitest";

function Branch({ onClose, onBranch }: { onClose: () => void; onBranch: () => void }) {
  return (
    <Dialog title="Branch Base case" onClose={onClose} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={onBranch}>Branch scenario</Button></>}>
      <p>The new scenario starts identical to Base case.</p>
      <Input id="scenario-name" label="Scenario name" autoFocus />
    </Dialog>
  );
}

test("the title names a modal dialog and focus lands on the autofocus field", async () => {
  render(<Branch onClose={() => {}} onBranch={() => {}} />);
  await act(() => settle());
  const dialog = screen.getByRole("dialog", { name: "Branch Base case" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(document.activeElement).toBe(screen.getByLabelText("Scenario name"));
});

test("Escape and the close button ask the caller to close; the buttons in the footer do their own thing", async () => {
  const onClose = vi.fn();
  const onBranch = vi.fn();
  render(<Branch onClose={onClose} onBranch={onBranch} />);
  await act(() => settle());
  const user = userEvent.setup();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClose).toHaveBeenCalledTimes(3);
  await user.click(screen.getByRole("button", { name: "Branch scenario" }));
  expect(onBranch).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledTimes(3);
});

test("pressing the scrim doesn't close it, and focus returns to what opened it", async () => {
  const onClose = vi.fn();
  function Page() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Branch the base case</Button>
        {open ? <Branch onClose={() => { onClose(); setOpen(false); }} onBranch={() => {}} /> : null}
      </>
    );
  }
  render(<Page />);
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: "Branch the base case" });
  await user.click(opener);
  await act(() => settle());
  await user.click(document.querySelector<HTMLElement>("[data-slot=dialog-backdrop]")!);
  expect(onClose).not.toHaveBeenCalled();
  await user.keyboard("{Escape}");
  await act(() => settle());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test("a dialog with nothing to focus in its body still takes focus", async () => {
  render(<Dialog title="Versions this month" onClose={() => {}}><p>No versions yet.</p></Dialog>);
  await act(() => settle());
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
});
