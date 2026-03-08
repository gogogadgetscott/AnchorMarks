import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initOmnibarListeners } from "@features/ui/omnibar.ts";
import { _testGetState } from "@features/bookmarks/omnibar-controller.ts";
import * as state from "@features/state.ts";

describe("UI Omnibar - Escape key", () => {
  beforeEach(() => {
    // jsdom does not implement this browser API used by omnibar list rendering.
    (Element.prototype as any).scrollIntoView = () => {};

    state.setFilterConfig({
      ...state.filterConfig,
      search: undefined,
    });

    // Ensure DOM elements present
    document.body.innerHTML = `
      <div class="omnibar-container">
        <input id="search-input" type="text" />
        <div id="omnibar-panel" class="omnibar-panel"></div>
        <div id="omnibar-recent" class="omnibar-section"></div>
        <div id="omnibar-tags" class="omnibar-section"></div>
        <div id="omnibar-actions" class="omnibar-section"></div>
        <div id="omnibar-results" class="omnibar-section hidden"></div>
        <div id="omnibar-recent-list"></div>
        <div id="omnibar-tags-list"></div>
        <div id="omnibar-actions-list"></div>
        <div id="omnibar-results-list"></div>
        <button id="omnibar-clear-recent"></button>
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
    await import("@features/bookmarks/omnibar-controller.ts");

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

  it("does not apply '>...' command queries to bookmark search filter", () => {
    const input = document.getElementById("search-input") as HTMLInputElement;

    input.value = ">settings";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(state.filterConfig.search).toBeUndefined();
  });
});
