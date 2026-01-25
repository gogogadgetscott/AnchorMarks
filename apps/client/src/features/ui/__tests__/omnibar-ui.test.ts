import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initOmnibarListeners } from "@features/ui/omnibar.ts";
import { _testGetState } from "@features/bookmarks/omnibar.ts";

describe("UI Omnibar - Escape key", () => {
  beforeEach(() => {
    // Ensure DOM elements present
    document.body.innerHTML = `
      <div class="omnibar-container">
        <input id="search-input" type="text" />
        <div id="omnibar-panel" class="omnibar-panel"></div>
      </div>
    `;
    initOmnibarListeners();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("clears the input and closes the omnibar when Escape is pressed", async () => {
    const input = document.getElementById("search-input") as HTMLInputElement;
    const panel = document.getElementById("omnibar-panel") as HTMLElement;

    // Ensure the omnibar module is loaded so the handler's dynamic import resolves quickly
    await import("@features/bookmarks/omnibar.ts");

    // Simulate opening/typing
    input.value = "something";
    panel.classList.remove("hidden");

    // Focus and send Escape
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    // Wait a tick for async handler to run
    await new Promise((r) => setTimeout(r, 0));

    expect(input.value).toBe("");
    // omnibar state should be closed
    expect(_testGetState().isOpen).toBe(false);
    // panel should have hidden class
    expect(panel.classList.contains("hidden")).toBe(true);
  });
});
