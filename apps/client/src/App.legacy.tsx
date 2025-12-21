import React, { useEffect } from "react";
import { AppProvider } from "./contexts/AppContext";
import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { logger } from "@utils/logger.ts";

// Feature imports
import {
  initFilterDropdown,
  updateFilterButtonVisibility,
} from "@features/bookmarks/filters.ts";
import { initTagInput } from "@features/bookmarks/tag-input.ts";
import SmartOrg from "@features/bookmarks/smart-organization-ui.ts";
import { handleKeyboard } from "@features/keyboard/handler.ts";
import { initNavigationListeners } from "@features/ui/navigation.ts";
import { initFormListeners } from "@features/ui/forms.ts";
import { initOmnibarListeners } from "@features/ui/omnibar.ts";
import { initInteractions } from "@features/ui/interactions.ts";
import { initTagListeners } from "@features/ui/tags.ts";

/**
 * AnchorMarks React App Component
 * Manages state and initialization while delegating rendering to legacy code
 */
const AppInner: React.FC = () => {
  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load theme from localStorage
        const savedTheme = localStorage.getItem("anchormarks_theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);

        // Check authentication
        const { checkAuth } = await import("@features/auth/auth.ts");
        const isAuthed = await checkAuth();

        if (isAuthed) {
          // Load settings and initial data
          const [
            { loadSettings },
            { updateUserInfo },
            { loadFolders },
            { loadBookmarks },
          ] = await Promise.all([
            import("@features/bookmarks/settings.ts"),
            import("@features/auth/auth.ts"),
            import("@features/bookmarks/folders.ts"),
            import("@features/bookmarks/bookmarks.ts"),
          ]);

          await Promise.all([
            loadSettings(),
            updateUserInfo(),
            loadFolders(),
            loadBookmarks(),
          ]);

          SmartOrg.init();
          initTagInput();

          // Initialize listeners
          initNavigationListeners();
          initFormListeners();
          initOmnibarListeners();
          initInteractions();
          initTagListeners();

          // Show main app
          const mainApp = document.getElementById("main-app");
          const authScreen = document.getElementById("auth-screen");
          if (mainApp) mainApp.classList.remove("hidden");
          if (authScreen) authScreen.classList.add("hidden");
        }
      } catch (err) {
        logger.error("Failed to initialize app", err);
      }
    };

    initializeApp();

    // Global keyboard shortcuts
    const keydownHandler = (e: KeyboardEvent) => handleKeyboard(e);
    document.addEventListener("keydown", keydownHandler);
    window.addEventListener("focus", () => {
      document.addEventListener("keydown", keydownHandler);
    });

    return () => {
      document.removeEventListener("keydown", keydownHandler);
    };
  }, []);

  // Return empty fragment - the loader has already populated the DOM
  // This component just manages React state and initialization
  return <></>;
};

// Wrap the app with context provider
const App: React.FC = () => {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
};

// ============================================================
// Utility Functions (backward compatibility)
// ============================================================

export async function setViewMode(
  mode: string,
  save = true,
): Promise<void> {
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

  if (state.currentView !== "dashboard" && state.currentView !== "tag-cloud") {
    const { renderBookmarks } = await import(
      "@features/bookmarks/bookmarks.ts"
    );
    renderBookmarks();
  }
}

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

export async function regenerateApiKey(): Promise<void> {
  if (!confirm("Regenerate API key? Old keys will stop working.")) return;
  try {
    const { showToast } = await import("@utils/ui-helpers.ts");
    const data = await api("/auth/regenerate-key", { method: "POST" });
    if (state.currentUser) state.currentUser.api_key = data.api_key;
    const apiKeyEl = document.getElementById("api-key-value");
    if (apiKeyEl) apiKeyEl.textContent = data.api_key;
    showToast("API key regenerated!", "success");
  } catch (err: any) {
    const { showToast } = await import("@utils/ui-helpers.ts");
    showToast(err.message, "error");
  }
}

export function copyApiKey(): void {
  navigator.clipboard.writeText(state.currentUser?.api_key || "");
  (async () => {
    const { showToast } = await import("@utils/ui-helpers.ts");
    showToast("API key copied!", "success");
  })();
}

export async function resetBookmarks(): Promise<void> {
  if (!confirm("Reset all bookmarks? This cannot be undone!")) return;
  try {
    const { showToast, closeModals, updateActiveNav } = await import(
      "@utils/ui-helpers.ts"
    );
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
    const { showToast } = await import("@utils/ui-helpers.ts");
    showToast(err.message, "error");
  }
}

// ============================================================
// Global API exports (backward compatibility)
// ============================================================

declare global {
  interface Window {
    AnchorMarks: any;
    launchBookmarkFromPalette: (id: string) => void;
    searchBookmarks: (query: string) => any[];
  }
}

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

  loadBookmarks: async () => {
    const { loadBookmarks } = await import(
      "@features/bookmarks/bookmarks.ts"
    );
    loadBookmarks();
  },
  loadFolders: async () => {
    const { loadFolders } = await import("@features/bookmarks/folders.ts");
    loadFolders();
  },
  renderBookmarks: async () => {
    const { renderBookmarks } = await import(
      "@features/bookmarks/bookmarks.ts"
    );
    renderBookmarks();
  },
  renderDashboard: async () => {
    const { renderDashboard } = await import(
      "@features/bookmarks/dashboard.ts"
    );
    renderDashboard();
  },
  renderFolders: async () => {
    const { renderFolders } = await import(
      "@features/bookmarks/folders.ts"
    );
    renderFolders();
  },
  saveSettings: async (settings: any) => {
    const { saveSettings } = await import(
      "@features/bookmarks/settings.ts"
    );
    saveSettings(settings);
  },
  loadSettings: async () => {
    const { loadSettings } = await import(
      "@features/bookmarks/settings.ts"
    );
    loadSettings();
  },
};

// Palette integration utilities
window.launchBookmarkFromPalette = (id: string) => {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (bookmark) window.open(bookmark.url, "_blank");
};

window.searchBookmarks = (query: string) => {
  return state.bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.url.toLowerCase().includes(query.toLowerCase()),
  );
};

export default App;
