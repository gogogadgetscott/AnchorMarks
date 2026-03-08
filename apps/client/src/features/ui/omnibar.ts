/**
 * AnchorMarks - Omnibar & Search UI Module
 * Handles search and omnibar event listeners
 */

import {
  openOmnibar,
  closeOmnibar,
  clearRecentSearches,
  renderOmnibarPanel,
} from "@features/bookmarks/omnibar.ts";
import * as state from "@features/state.ts";

/**
 * Initialize all search and omnibar related listeners
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

    // Don't apply filters to favorites or recent views - they show all items
    if (state.currentView === "favorites" || state.currentView === "recent") {
      // Clear any existing search filter when on these views
      if (state.filterConfig.search) {
        state.setFilterConfig({
          ...state.filterConfig,
          search: undefined,
        });
      }
      // Still render bookmarks to update display, but filters won't be applied
      if (searchFilterTimeout) clearTimeout(searchFilterTimeout);
      searchFilterTimeout = setTimeout(() => {
        import("@features/bookmarks/bookmarks.ts").then((bookmarksModule) => {
          bookmarksModule.renderBookmarks();
        });
      }, 120);
      return;
    }

    // Keep bookmark list filtered: persist search and refetch from server so search is full-library
    const trimmed = query.trim();

    // Command-mode omnibar queries (">...") are for quick actions/settings,
    // not bookmark filtering, so keep them out of persistent search filters.
    if (trimmed.startsWith(">")) {
      const hadSearchFilter = Boolean(state.filterConfig.search);
      if (state.filterConfig.search !== undefined) {
        state.setFilterConfig({
          ...state.filterConfig,
          search: undefined,
        });
      }

      if (hadSearchFilter) {
        if (searchFilterTimeout) clearTimeout(searchFilterTimeout);
        searchFilterTimeout = setTimeout(() => {
          import("@features/bookmarks/bookmarks.ts").then((bookmarksModule) => {
            bookmarksModule.renderBookmarks();
          });
          import("@features/bookmarks/search.ts").then((mod) =>
            mod.renderActiveFilters(),
          );
          import("@features/bookmarks/filters.ts").then((mod) =>
            mod.updateFilterButtonText(),
          );
        }, 120);
      }
      return;
    }

    state.setFilterConfig({
      ...state.filterConfig,
      search: trimmed,
    });

    if (searchFilterTimeout) clearTimeout(searchFilterTimeout);
    searchFilterTimeout = setTimeout(() => {
      import("@features/bookmarks/filters.ts").then((m) => {
        const applyFilters = m.applyFilters;
        if (typeof applyFilters !== "function") return;
        applyFilters().then(() => {
          import("@features/bookmarks/search.ts").then((mod) =>
            mod.renderActiveFilters(),
          );
          import("@features/bookmarks/filters.ts").then((mod) =>
            mod.updateFilterButtonText(),
          );
        });
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
