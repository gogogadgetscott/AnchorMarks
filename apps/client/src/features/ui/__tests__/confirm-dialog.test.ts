import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@utils/logger.ts");
import { ConfirmDialog, confirmDialog } from "../confirm-dialog";

function setupModalDom() {
  document.body.innerHTML = `
    <div id="generic-confirm-modal" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div>
        <h2 class="confirm-title"></h2>
        <p class="confirm-message"></p>
        <button class="confirm-ok"></button>
        <button class="confirm-cancel"></button>
      </div>
    </div>
  `;
}

describe("confirm dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    const existing = document.getElementById("generic-confirm-modal");
    existing?.remove();
    (ConfirmDialog as any).instance = undefined;
  });

  it("creates modal lazily when missing", async () => {
    const promise = ConfirmDialog.getInstance().show("Delete bookmark?");

    const modal = document.getElementById("generic-confirm-modal");
    expect(modal).not.toBeNull();
    expect(modal?.classList.contains("hidden")).toBe(false);
    expect(modal?.querySelector(".confirm-message")?.textContent).toBe(
      "Delete bookmark?",
    );

    modal?.querySelector<HTMLElement>(".confirm-ok")?.click();
    await expect(promise).resolves.toBe(true);
  });

  it("resolves true on confirm and false on cancel", async () => {
    setupModalDom();

    const dialog = ConfirmDialog.getInstance();
    const confirmSpy = vi.spyOn(dialog as any, "createModalElement");

    const confirmPromise = dialog.show("Proceed?");
    document.querySelector<HTMLElement>(".confirm-ok")?.click();
    await expect(confirmPromise).resolves.toBe(true);

    const cancelPromise = dialog.show("Stop?", { destructive: true });
    document.querySelector<HTMLElement>(".confirm-cancel")?.click();
    await expect(cancelPromise).resolves.toBe(false);

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("supports keyboard dismissal via Escape", async () => {
    setupModalDom();
    const dialog = ConfirmDialog.getInstance();
    const promise = dialog.show("Escape?");

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    window.dispatchEvent(event);

    await expect(promise).resolves.toBe(false);
  });

  it("exports helper that respects options", async () => {
    setupModalDom();
    const result = confirmDialog("Danger action", {
      title: "Delete",
      confirmText: "Yes, delete",
      cancelText: "Keep",
      destructive: true,
    });

    const title = document.querySelector(".confirm-title")?.textContent;
    const confirmText = document.querySelector(".confirm-ok")?.textContent;
    const cancelText = document.querySelector(".confirm-cancel")?.textContent;

    expect(title).toBe("Delete");
    expect(confirmText).toBe("Yes, delete");
    expect(cancelText).toBe("Keep");
    expect(
      document.querySelector(".confirm-ok")?.classList.contains("btn-danger"),
    ).toBe(true);

    document.querySelector<HTMLElement>(".confirm-ok")?.click();
    await expect(result).resolves.toBe(true);
  });
});
