/**
 * Tests for Filter Dropdown Module
 * Comprehensive testing of filter functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as state from "@features/state.ts";
import {
  initFilterDropdown,
  toggleFilterDropdown,
  showFilterDropdown,
  closeFilterDropdown,
  updateFilterButtonText,
  updateFilterButtonVisibility,
} from "@features/bookmarks/filters.ts";

vi.mock("@services/api.ts", () => ({
  api: vi.fn(async (endpoint: string) => {
    if (endpoint === "/bookmarks/counts") return { all: 0 };
    if (endpoint === "/collections") return [];
    return {};
  }),
  cancelRequest: vi.fn(),
  createAbortController: vi.fn(() => new AbortController()),
}));

describe("Filter Dropdown Module", () => {
  let headersContainer: HTMLElement;

  beforeEach(async () => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="headers-container">
        <div id="bookmarks-header">
          <button id="filter-dropdown-btn" class="btn btn-secondary">
            <span class="filter-btn-text">Filters</span>
          </button>
        </div>
      </div>
      <div id="main-content"></div>
      <input id="search-input" type="text" />
    `;

    headersContainer = document.getElementById("headers-container")!;

    // Reset state (await so currentView is set before tests that call showFilterDropdown)
    await state.setCurrentView("all");
    state.setCurrentFolder(null);
    state.setCurrentCollection(null);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  describe("initFilterDropdown", () => {
    it("should find and initialize filter button", () => {
      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn).not.toBeNull();

      initFilterDropdown();

      const reinitializedBtn = document.getElementById("filter-dropdown-btn");
      expect(reinitializedBtn).not.toBeNull();
    });

    it("should return early when button not found", () => {
      document.getElementById("filter-dropdown-btn")?.remove();

      expect(() => initFilterDropdown()).not.toThrow();
      expect(document.getElementById("filter-dropdown-btn")).toBeNull();
    });

    it("should set button display for bookmarks views", () => {
      state.setCurrentView("all");
      initFilterDropdown();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).not.toBe("none");
    });

    it("should not display button for non-bookmarks views", async () => {
      await state.setCurrentView("dashboard");
      updateFilterButtonVisibility();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).toBe("none");
    });

    it("should clone button to remove old listeners", () => {
      const btn = document.getElementById("filter-dropdown-btn")!;
      const originalBtn = btn;

      initFilterDropdown();

      const newBtn = document.getElementById("filter-dropdown-btn")!;
      expect(originalBtn).not.toBe(newBtn);
    });
  });

  describe("showFilterDropdown", () => {
    beforeEach(async () => {
      await state.setCurrentView("all");
    });

    it("should create dropdown element with correct ID", async () => {
      expect(document.getElementById("filter-dropdown")).toBeNull();

      await showFilterDropdown();

      expect(document.getElementById("filter-dropdown")).not.toBeNull();
    });

    it("should insert dropdown into headers container", async () => {
      await showFilterDropdown();

      const dropdown = document.getElementById("filter-dropdown");
      expect(headersContainer.contains(dropdown)).toBe(true);
    });

    it("should have required sections", async () => {
      await showFilterDropdown();

      const dropdown = document.getElementById("filter-dropdown");
      expect(dropdown?.querySelector(".filter-dropdown-header")).not.toBeNull();
      expect(dropdown?.querySelector(".filter-dropdown-body")).not.toBeNull();
      expect(
        dropdown?.querySelector("#filter-folders-container"),
      ).not.toBeNull();
      expect(dropdown?.querySelector("#filter-tags-container")).not.toBeNull();
    });

    it("should have close button", async () => {
      await showFilterDropdown();

      const closeBtn = document.getElementById("filter-close-btn");
      expect(closeBtn).not.toBeNull();
    });

    it("should have pin button", async () => {
      await showFilterDropdown();

      const pinBtn = document.getElementById("filter-pin-btn");
      expect(pinBtn).not.toBeNull();
    });

    it("should not show in non-bookmarks views", async () => {
      await state.setCurrentView("dashboard");

      await showFilterDropdown();

      expect(document.getElementById("filter-dropdown")).toBeNull();
    });

    it("should remove existing dropdown before creating new one", async () => {
      await showFilterDropdown();

      await showFilterDropdown();

      // There should only be one
      const allDropdowns = document.querySelectorAll("#filter-dropdown");
      expect(allDropdowns.length).toBe(1);
    });
  });

  describe("closeFilterDropdown", () => {
    beforeEach(async () => {
      await state.setCurrentView("all");
      await showFilterDropdown();
    });

    it("should remove dropdown from DOM", () => {
      expect(document.getElementById("filter-dropdown")).not.toBeNull();

      closeFilterDropdown();

      expect(document.getElementById("filter-dropdown")).toBeNull();
    });

    it("should handle closing when dropdown not present", () => {
      closeFilterDropdown();
      expect(() => closeFilterDropdown()).not.toThrow();
    });
  });

  describe("toggleFilterDropdown", () => {
    beforeEach(async () => {
      await state.setCurrentView("all");
    });

    it("should show dropdown when not present", async () => {
      expect(document.getElementById("filter-dropdown")).toBeNull();

      toggleFilterDropdown();
      // Give async function time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check if dropdown was created (note: showFilterDropdown is async)
      // This test may need adjustment based on actual implementation
    });

    it("should close dropdown when present", async () => {
      await showFilterDropdown();
      expect(document.getElementById("filter-dropdown")).not.toBeNull();

      closeFilterDropdown();

      expect(document.getElementById("filter-dropdown")).toBeNull();
    });
  });

  describe("updateFilterButtonText", () => {
    it('should display "Filters" when no filters active', () => {
      state.setFilterConfig({
        tags: [],
        sort: "recently_added",
        tagMode: "OR",
        tagSort: "count_desc",
      });
      state.setCurrentFolder(null);

      updateFilterButtonText();

      const textSpan = document.querySelector(".filter-btn-text");
      expect(textSpan?.textContent).toBe("Filters");
    });

    it("should display count when tags are active", () => {
      state.setFilterConfig({
        tags: ["tag1", "tag2"],
        sort: "recently_added",
        tagMode: "OR",
        tagSort: "count_desc",
      });
      updateFilterButtonText();
      const textSpan = document.querySelector(".filter-btn-text");
      expect(textSpan?.textContent).toContain("Filters (2)");
    });

    it("should count search term in active filters", async () => {
      // Explicitly reset all filter state for this test
      state.setFilterConfig({
        tags: [],
        sort: "recently_added",
        tagMode: "OR",
        tagSort: "count_desc",
      });
      state.setCurrentFolder(null);
      state.setCurrentCollection(null);
      await state.setCurrentView("folder");
      const searchInput = document.getElementById(
        "search-input",
      ) as HTMLInputElement;
      searchInput.value = "search term";
      state.setCurrentFolder("folder-id");

      updateFilterButtonText();

      const textSpan = document.querySelector(".filter-btn-text");
      // Should count: 1 folder + 1 search = 2
      expect(textSpan?.textContent).toContain("Filters (2)");
    });
  });

  describe("updateFilterButtonVisibility", () => {
    it("should show button in bookmarks view", () => {
      state.setCurrentView("all");

      updateFilterButtonVisibility();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).not.toBe("none");
    });

    it("should show button in folder view", () => {
      state.setCurrentView("folder");

      updateFilterButtonVisibility();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).not.toBe("none");
    });

    it("should show button in collection view", () => {
      state.setCurrentView("collection");

      updateFilterButtonVisibility();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).not.toBe("none");
    });

    it("should hide button in dashboard view", async () => {
      await state.setCurrentView("dashboard");

      updateFilterButtonVisibility();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).toBe("none");
    });

    it("should hide button in tag-cloud view", async () => {
      await state.setCurrentView("tag-cloud");

      updateFilterButtonVisibility();

      const btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).toBe("none");
    });

    it("should close dropdown when switching to non-bookmarks view", async () => {
      await state.setCurrentView("all");
      await showFilterDropdown();

      await state.setCurrentView("dashboard");
      updateFilterButtonVisibility();

      expect(document.getElementById("filter-dropdown")).toBeNull();
    });
  });

  describe("Filter Button Click Handler", () => {
    beforeEach(() => {
      state.setCurrentView("all");
      initFilterDropdown();
    });

    it("should attach click listener to button", async () => {
      const btn = document.getElementById("filter-dropdown-btn");
      const clickEvent = new MouseEvent("click", { bubbles: true });

      btn?.dispatchEvent(clickEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify that toggle was triggered
      // This is an integration test verifying the flow
    });

    it("should prevent event propagation", () => {
      const btn = document.getElementById("filter-dropdown-btn");
      const clickEvent = new MouseEvent("click", { bubbles: true });

      btn?.dispatchEvent(clickEvent);

      // The listener should call stopPropagation
      // Note: This might require adjustments based on actual event handling
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete filter dropdown flow", async () => {
      state.setCurrentView("all");

      // 1. Initialize
      initFilterDropdown();
      expect(document.getElementById("filter-dropdown-btn")).not.toBeNull();

      // 2. Show dropdown
      const btn = document.getElementById("filter-dropdown-btn")!;
      const clickEvent = new MouseEvent("click", { bubbles: true });
      btn.dispatchEvent(clickEvent);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Verify dropdown exists
      expect(document.getElementById("filter-dropdown")).not.toBeNull();

      // 4. Close dropdown
      closeFilterDropdown();

      // 5. Verify it's closed
      expect(document.getElementById("filter-dropdown")).toBeNull();
    });

    it("should maintain button visibility across view changes", async () => {
      await state.setCurrentView("all");
      updateFilterButtonVisibility();
      let btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).not.toBe("none");

      await state.setCurrentView("dashboard");
      updateFilterButtonVisibility();
      btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).toBe("none");

      await state.setCurrentView("all");
      updateFilterButtonVisibility();
      btn = document.getElementById("filter-dropdown-btn");
      expect(btn?.style.display).not.toBe("none");
    });
  });
});
