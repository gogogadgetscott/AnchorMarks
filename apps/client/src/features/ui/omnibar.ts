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
import {
  renderCommandPaletteList,
  updateCommandPaletteActive,
  runActiveCommand,
} from "@features/bookmarks/commands.ts";
import * as state from "@features/state.ts";

/**
 * Initialize all search and palette related listeners
 */
export function initOmnibarListeners(): void {
  const searchInput = document.getElementById(
    "search-input",
  ) as HTMLInputElement;
  if (!searchInput) return;

  let searchTimeout: ReturnType<typeof setTimeout> | undefined;
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

  // Input - search
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value;
    renderOmnibarPanel(query);

    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      state.setDisplayedCount(state.BOOKMARKS_PER_PAGE);
      const { renderBookmarks } =
        await import("@features/bookmarks/bookmarks.ts");
      renderBookmarks();
      updateFilterButtonText();
    }, 300);
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

  // Command Palette input
  const commandPaletteInput = document.getElementById(
    "quick-launch-input",
  ) as HTMLInputElement;
  commandPaletteInput?.addEventListener("input", () => {
    renderCommandPaletteList(commandPaletteInput.value || "");
  });

  // Command Palette keyboard
  commandPaletteInput?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      updateCommandPaletteActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      updateCommandPaletteActive(-1);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      updateCommandPaletteActive(5);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      updateCommandPaletteActive(-5);
    } else if (e.key === "Home") {
      e.preventDefault();
      updateCommandPaletteActive(-state.commandPaletteActiveIndex);
    } else if (e.key === "End") {
      e.preventDefault();
      updateCommandPaletteActive(
        state.commandPaletteEntries.length -
          1 -
          state.commandPaletteActiveIndex,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActiveCommand();
    }
  });
}
