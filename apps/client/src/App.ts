/**
 * AnchorMarks - Main Application Entry Point
 * This file imports all modules and initializes the application.
 */

// Import state
import * as state from "@features/state.ts";

declare global {
  interface Window {
    AnchorMarks: any;
    launchBookmarkFromPalette: (id: string) => void;
    searchBookmarks: (query: string) => any[];
  }
}

// Import API
import { api } from "@services/api.ts";

// Import utilities
import { escapeHtml, getHostname, parseTagInput } from "@utils/index.ts";
import { logger } from "@utils/logger.ts";

// Import UI helpers
import {
  showToast,
  openModal,
  closeModals,
  addTagToInput,
  initDom,
  updateActiveNav,
} from "@utils/ui-helpers.ts";

// Import filters
import {
  initFilterDropdown,
  updateFilterButtonVisibility,
} from "@features/bookmarks/filters.ts";

// Import tag input
import { initTagInput } from "@features/bookmarks/tag-input.ts";

// Import Smart Organization UI
import SmartOrg from "@features/bookmarks/smart-organization-ui.ts";

// ============================================================
// New Modular UI Listeners
// ============================================================
import { handleKeyboard } from "@features/keyboard/handler.ts";
import { initNavigationListeners } from "@features/ui/navigation.ts";
import { initFormListeners } from "@features/ui/forms.ts";
import { initOmnibarListeners } from "@features/ui/omnibar.ts";
import { initInteractions } from "@features/ui/interactions.ts";
import { initTagListeners } from "@features/ui/tags.ts";

/**
 * Set view mode (grid / list / compact)
 */
export async function setViewMode(mode: string, save = true): Promise<void> {
  state.setViewMode(mode as any);
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      (btn as HTMLElement).dataset.viewMode === mode,
    );
  });
  if (save) {
    const { saveSettings } = await import("@features/bookmarks/settings.ts");
    await saveSettings({ view_mode: mode });
  }

  // Only render bookmarks if we're not in dashboard or tag cloud view
  if (state.currentView !== "dashboard" && state.currentView !== "tag-cloud") {
    const { renderBookmarks } =
      await import("@features/bookmarks/bookmarks.ts");
    renderBookmarks();
  }
}

/**
 * Attach click listeners to view-toggle buttons
 */
export function attachViewToggleListeners(): void {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.removeEventListener("click", (btn as any)._viewToggleHandler);
    const handler = async (e: Event) => {
      e.preventDefault();
      const mode = (btn as HTMLElement).dataset.viewMode;
      if (mode) await setViewMode(mode);
    };
    (btn as any)._viewToggleHandler = handler;
    btn.addEventListener("click", handler);
  });
}

/**
 * API Key functions
 */
export async function regenerateApiKey(): Promise<void> {
  if (!confirm("Regenerate API key? Old keys will stop working.")) return;
  try {
    const data = await api("/auth/regenerate-key", { method: "POST" });
    if (state.currentUser) state.currentUser.api_key = data.api_key;
    const apiKeyEl = document.getElementById("api-key-value");
    if (apiKeyEl) apiKeyEl.textContent = data.api_key;
    showToast("API key regenerated!", "success");
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

export function copyApiKey(): void {
  navigator.clipboard.writeText(state.currentUser?.api_key || "");
  showToast("API key copied!", "success");
}

/**
 * Reset all bookmarks to default
 */
export async function resetBookmarks(): Promise<void> {
  if (!confirm("Reset all bookmarks? This cannot be undone!")) return;
  try {
    const data = await api("/settings/reset-bookmarks", { method: "POST" });
    state.setCurrentFolder(null);
    state.setCurrentView("all");
    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Bookmarks";

    const [{ loadFolders }, { loadBookmarks }] = await Promise.all([
      import("@features/bookmarks/folders.ts"),
      import("@features/bookmarks/bookmarks.ts"),
    ]);

    await Promise.all([loadFolders(), loadBookmarks()]);
    updateActiveNav();
    closeModals();
    showToast(
      `Bookmarks reset! ${data.bookmarks_created} example bookmarks created.`,
      "success",
    );
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

/**
 * Initialize application state and UI
 */
export async function initializeApp(): Promise<void> {
  const { updateUserInfo } = await import("@features/auth/auth.ts");
  const { loadFolders } = await import("@features/bookmarks/folders.ts");
  const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");

  updateUserInfo();
  await Promise.all([loadFolders(), loadBookmarks()]);

  if (state.currentView === "dashboard") {
    const { renderDashboard } =
      await import("@features/bookmarks/dashboard.ts");
    renderDashboard();
  }

  setViewMode(state.viewMode, false);
  updateActiveNav();
  initFilterDropdown();
  updateFilterButtonVisibility();

  // Initialize sidebar filter controls with current state
  const settingsTagSort = document.getElementById(
    "settings-tag-sort",
  ) as HTMLSelectElement;
  if (settingsTagSort)
    settingsTagSort.value = state.filterConfig.tagSort || "count_desc";
}

// ============================================================
// Main Entry Point
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize DOM references
  initDom();

  // Load theme
  const savedTheme = localStorage.getItem("anchormarks_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    const themeSelect = document.getElementById(
      "theme-select",
    ) as HTMLSelectElement;
    if (themeSelect) themeSelect.value = savedTheme;
  }

  // Security: Immediately hide auth forms if user might be authenticated
  const authScreen = document.getElementById("auth-screen");
  if (authScreen && !authScreen.classList.contains("hidden")) {
    ["login-form", "register-form"].forEach((id) => {
      const form = document.getElementById(id);
      if (form) {
        form.setAttribute("data-bitwarden-watching", "false");
        form.setAttribute("data-lpignore", "true");
        form.style.display = "none";
      }
    });
  }

  // Check authentication
  const { checkAuth, showMainApp } = await import("@features/auth/auth.ts");
  const isAuthed = await checkAuth();
  if (isAuthed) {
    const { loadSettings } = await import("@features/bookmarks/settings.ts");
    await loadSettings();
    showMainApp();
    await initializeApp();
    SmartOrg.init();
    initTagInput();
  }

  // Initialize modular listeners
  initNavigationListeners();
  initFormListeners();
  initOmnibarListeners();
  initInteractions();
  initTagListeners();

  // Global keyboard shortcuts
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("focus", () => {
    document.addEventListener("keydown", handleKeyboard);
  });

  // Filter sort listener (kept here for now as it's simple)
  document.getElementById("filter-sort")?.addEventListener("change", (e) => {
    state.filterConfig.sort = (e.target as HTMLSelectElement).value;
    import("@features/bookmarks/bookmarks.ts").then(({ renderBookmarks }) =>
      renderBookmarks(),
    );
  });
});

// ============================================================
// Global API Export
// ============================================================

window.AnchorMarks = {
  api,
  isAuthenticated: () => state.isAuthenticated,
  get bookmarks() {
    return state.bookmarks;
  },
  set bookmarks(val) {
    state.setBookmarks(val);
  },
  get folders() {
    return state.folders;
  },
  set folders(val) {
    state.setFolders(val);
  },
  get currentView() {
    return state.currentView;
  },
  set currentView(val) {
    state.setCurrentView(val);
  },
  get currentFolder() {
    return state.currentFolder;
  },
  set currentFolder(val) {
    state.setCurrentFolder(val);
  },
  get filterConfig() {
    return state.filterConfig;
  },
  get selectedBookmarks() {
    return state.selectedBookmarks;
  },
  get viewMode() {
    return state.viewMode;
  },
  get hideFavicons() {
    return state.hideFavicons;
  },
  get aiSuggestionsEnabled() {
    return state.aiSuggestionsEnabled;
  },
  get dashboardConfig() {
    return state.dashboardConfig;
  },

  showToast,
  openModal,
  closeModals,
  escapeHtml,
  getHostname,
  parseTagInput,
  addTagToInput,

  loadBookmarks: async () => {
    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
    loadBookmarks();
  },
  loadFolders: async () => {
    const { loadFolders } = await import("@features/bookmarks/folders.ts");
    loadFolders();
  },
  renderBookmarks: async () => {
    const { renderBookmarks } =
      await import("@features/bookmarks/bookmarks.ts");
    renderBookmarks();
  },
  renderDashboard: async () => {
    const { renderDashboard } =
      await import("@features/bookmarks/dashboard.ts");
    renderDashboard();
  },
  renderFolders: async () => {
    const { renderFolders } = await import("@features/bookmarks/folders.ts");
    renderFolders();
  },
  saveSettings: async (settings: any) => {
    const { saveSettings } = await import("@features/bookmarks/settings.ts");
    saveSettings(settings);
  },
  loadSettings: async () => {
    const { loadSettings } = await import("@features/bookmarks/settings.ts");
    loadSettings();
  },
};

// palette integration utilities
(window as any).launchBookmarkFromPalette = (id: string) => {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (bookmark) window.open(bookmark.url, "_blank");
};

(window as any).searchBookmarks = (query: string) => {
  return state.bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.url.toLowerCase().includes(query.toLowerCase()),
  );
};
