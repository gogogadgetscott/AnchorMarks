import * as state from "@features/state.ts";
import {
  openOmnibar,
  closeOmnibar,
  renderOmnibarPanel,
  clearRecentSearches,
} from "@features/bookmarks/omnibar.ts";

/**
 * Legacy omnibar event wiring shim.
 * Keeps old imperative entrypoint used by tests and fallback flows.
 */
export function initOmnibarListeners(): void {
  const input = document.getElementById(
    "search-input",
  ) as HTMLInputElement | null;
  if (!input || input.dataset.omnibarInitialized === "true") return;

  input.dataset.omnibarInitialized = "true";

  input.addEventListener("focus", () => {
    openOmnibar();
  });

  input.addEventListener("input", () => {
    const query = input.value;

    if (query.startsWith(">")) {
      state.setFilterConfig({ ...state.filterConfig, search: undefined });
    } else {
      const normalized = query.trim();
      state.setFilterConfig({
        ...state.filterConfig,
        search: normalized || undefined,
      });
    }

    renderOmnibarPanel(query);
  });

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;

    input.value = "";
    state.setFilterConfig({ ...state.filterConfig, search: undefined });
    closeOmnibar();
  });

  const clearRecentBtn = document.getElementById("omnibar-clear-recent");
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener("click", (event: Event) => {
      event.preventDefault();
      clearRecentSearches();
    });
  }
}
