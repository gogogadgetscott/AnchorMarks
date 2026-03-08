import { beforeEach, describe, expect, it, vi } from "vitest";

const { openOmnibarMock } = vi.hoisted(() => ({
  openOmnibarMock: vi.fn(),
}));

vi.mock("@features/bookmarks/omnibar-controller.ts", () => ({
  openOmnibar: openOmnibarMock,
  closeOmnibar: vi.fn(),
}));

vi.mock("@utils/ui-helpers.ts", () => ({
  openModal: vi.fn(),
  updateActiveNav: vi.fn(),
}));

vi.mock("@features/state.ts", () => ({
  bulkMode: false,
  currentView: "all",
  setCurrentFolder: vi.fn(),
}));

vi.mock("@utils/keyboard-shortcuts.ts", () => ({
  keyboardShortcuts: {
    handleKeyPress: vi.fn(() => false),
  },
}));

import { handleKeyboard } from "../handler.ts";

describe("handleKeyboard slash shortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<input id="search-input" type="text" />';
  });

  it("opens omnibar with '/' outside text fields", async () => {
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    const event = new KeyboardEvent("keydown", { key: "/", cancelable: true });

    await handleKeyboard(event);

    expect(openOmnibarMock).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(searchInput);
  });

  it("does not hijack '/' when typing in an input", async () => {
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    searchInput.focus();
    const event = new KeyboardEvent("keydown", { key: "/", cancelable: true });

    await handleKeyboard(event);

    expect(openOmnibarMock).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
