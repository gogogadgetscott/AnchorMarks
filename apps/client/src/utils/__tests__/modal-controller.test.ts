import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerModalDispatcher,
  openBookmarkModal,
  openTagModal,
  openFolderModal,
  openSettingsModal,
  closeModals,
  openModal,
  closeModal,
} from "../modal-controller";

describe("Modal Controller", () => {
  let dispatcherFn: any = null;

  beforeEach(() => {
    dispatcherFn = vi.fn();
    registerModalDispatcher(dispatcherFn);
  });

  it("registers modal dispatcher", () => {
    const mockDispatcher = vi.fn();
    registerModalDispatcher(mockDispatcher);
    openBookmarkModal();
    expect(mockDispatcher).toHaveBeenCalled();
  });

  it("opens bookmark modal with data", () => {
    openBookmarkModal({ url: "https://example.com" });
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-bookmark",
      payload: { url: "https://example.com" },
    });
  });

  it("opens bookmark modal without data", () => {
    openBookmarkModal();
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-bookmark",
      payload: undefined,
    });
  });

  it("opens tag modal with name and color", () => {
    openTagModal("javascript", "#6366f1");
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-tag",
      payload: { tagName: "javascript", color: "#6366f1" },
    });
  });

  it("opens folder modal with data", () => {
    openFolderModal({ name: "My Collection" });
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-folder",
      payload: { name: "My Collection" },
    });
  });

  it("opens settings modal without tab", () => {
    openSettingsModal();
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-settings",
      payload: { tab: undefined },
    });
  });

  it("opens settings modal with specific tab", () => {
    openSettingsModal("api");
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-settings",
      payload: { tab: "api" },
    });
  });

  it("closes all modals", () => {
    closeModals();
    expect(dispatcherFn).toHaveBeenCalledWith({ type: "close" });
  });

  it("legacy openModal maps bookmark-modal to dispatch", () => {
    openModal("bookmark-modal");
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-bookmark",
      payload: undefined,
    });
  });

  it("legacy openModal maps tag-modal to dispatch", () => {
    openModal("tag-modal");
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-tag",
      payload: { tagName: "", color: "#f59e0b" },
    });
  });

  it("legacy openModal maps folder-modal to dispatch", () => {
    openModal("folder-modal");
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-folder",
      payload: undefined,
    });
  });

  it("legacy openModal maps settings-modal to dispatch", () => {
    openModal("settings-modal");
    expect(dispatcherFn).toHaveBeenCalledWith({
      type: "open-settings",
      payload: { tab: "general" },
    });
  });

  it("legacy closeModal closes all modals", () => {
    closeModal();
    expect(dispatcherFn).toHaveBeenCalledWith({ type: "close" });
  });

  it("warns when dispatcher is not registered", () => {
    const consoleSpy = vi.spyOn(console, "warn");
    registerModalDispatcher(null as any);
    openBookmarkModal();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Modal dispatcher not initialized"),
    );
    consoleSpy.mockRestore();
  });
});
