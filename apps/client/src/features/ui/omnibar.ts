/**
 * AnchorMarks - Omnibar & Command Palette UI Module
 * Handles search, omnibar, and command palette event listeners
 */

import {
  openOmnibar,
  closeOmnibar,
  clearRecentSearches,
  renderOmnibarPanel,
} from "@features/bookmarks/omnibar.ts";
import { updateFilterButtonText } from "@features/bookmarks/filters.ts";
import * as state from "@features/state.ts";

/**
 * Initialize all search and palette related listeners
 */
export function initOmnibarListeners(): void {
  const searchInput = document.getElementById(
    "search-input",
  ) as HTMLInputElement;
  if (!searchInput) return;

  let omnibarCloseTimeout: ReturnType<typeof setTimeout> | undefined;

  // Focus - open omnibar
  searchInput.addEventListener("focus", () => {
    if (omnibarCloseTimeout) clearTimeout(omnibarCloseTimeout);
    openOmnibar();
  });

  // Blur - close omnibar with delay
  searchInput.addEventListener("blur", () => {
    omnibarCloseTimeout = setTimeout(() => {
      closeOmnibar();
    }, 200);
  });

  // Debounce timer for live bookmark filtering from the main search box
  let searchFilterTimeout: ReturnType<typeof setTimeout> | undefined;

  // Input - search
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value;
    renderOmnibarPanel(query);

    // Keep bookmark list filtered in real time using the search box
    const trimmed = query.trim();
    state.setFilterConfig({
      ...state.filterConfig,
      search: trimmed,
    });

    if (searchFilterTimeout) clearTimeout(searchFilterTimeout);
    searchFilterTimeout = setTimeout(() => {
      Promise.all([
        import("@features/bookmarks/bookmarks.ts"),
        import("@features/bookmarks/search.ts"),
        import("@features/bookmarks/filters.ts"),
      ]).then(([bookmarksModule, searchModule, filtersModule]) => {
        bookmarksModule.renderBookmarks();
        searchModule.renderActiveFilters();
        filtersModule.updateFilterButtonText();
      });
    }, 120);
  });

  // Keyboard navigation in omnibar
  searchInput.addEventListener("keydown", async (e) => {
    const panel = document.getElementById("omnibar-panel");
    const isPanelOpen = panel && !panel.classList.contains("hidden");
    if (!isPanelOpen) return;

    const { navigateOmnibar, executeActiveItem, addRecentSearch } =
      await import("@features/bookmarks/omnibar.ts");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateOmnibar("down");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateOmnibar("up");
    } else if (e.key === "Enter") {
      const query = searchInput.value.trim();
      const resultsSection = document.getElementById("omnibar-results");
      const isShowingResults =
        resultsSection && !resultsSection.classList.contains("hidden");

      if (isShowingResults && query) {
        e.preventDefault();
        executeActiveItem();
        if (
          !query.startsWith(">") &&
          !query.startsWith("@") &&
          !query.startsWith("#")
        ) {
          addRecentSearch(query);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Clear the input and close the omnibar
      searchInput.value = "";
      renderOmnibarPanel("");
      closeOmnibar();
      searchInput.blur();
    }
  });

  // Click outside to close omnibar
  document.addEventListener("click", (e) => {
    const omnibarContainer = document.querySelector(".omnibar-container");
    const target = e.target as HTMLElement;
    if (omnibarContainer && !omnibarContainer.contains(target)) {
      closeOmnibar();
    }
  });

  // Clear recent searches button
  document
    .getElementById("omnibar-clear-recent")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      clearRecentSearches();
    });

  // Filter tag search input
  document
    .getElementById("filter-tag-search")
    ?.addEventListener("input", async () => {
      const { renderActiveFilters } =
        await import("@features/bookmarks/search.ts");
      renderActiveFilters();
    });
}
