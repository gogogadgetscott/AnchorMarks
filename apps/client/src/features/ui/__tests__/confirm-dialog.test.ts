import { beforeEach, describe, expect, it, vi } from "vitest";

const { showConfirmMock } = vi.hoisted(() => ({
  showConfirmMock: vi.fn(),
}));

vi.mock("@/contexts/ConfirmContext", () => ({
  showConfirm: showConfirmMock,
  showPrompt: vi.fn(),
  showTagPicker: vi.fn(),
}));

import { ConfirmDialog, confirmDialog } from "../confirm-dialog";

describe("confirm dialog bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ConfirmDialog as any).instance = undefined;
  });

  it("confirmDialog delegates to ConfirmDialog singleton", async () => {
    showConfirmMock.mockResolvedValueOnce(true);

    await expect(
      confirmDialog("Delete bookmark?", { destructive: true }),
    ).resolves.toBe(true);

    expect(showConfirmMock).toHaveBeenCalledWith("Delete bookmark?", {
      destructive: true,
    });
  });

  it("ConfirmDialog.getInstance returns singleton", () => {
    const first = ConfirmDialog.getInstance();
    const second = ConfirmDialog.getInstance();

    expect(first).toBe(second);
  });

  it("ConfirmDialog.show delegates to showConfirm", async () => {
    showConfirmMock.mockResolvedValueOnce(false);

    await expect(
      ConfirmDialog.getInstance().show("Proceed?", {
        title: "Confirm",
        confirmText: "Yes",
        cancelText: "No",
      }),
    ).resolves.toBe(false);

    expect(showConfirmMock).toHaveBeenCalledWith("Proceed?", {
      title: "Confirm",
      confirmText: "Yes",
      cancelText: "No",
    });
  });
});
