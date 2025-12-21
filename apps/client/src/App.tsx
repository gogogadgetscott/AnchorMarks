import React, { useEffect, useState } from "react";
import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { escapeHtml, getHostname, parseTagInput } from "@utils/index.ts";
import {
  showToast,
  openModal,
  closeModals,
  addTagToInput,
  initDom,
  updateActiveNav,
} from "@utils/ui-helpers.ts";
import { logger } from "@utils/logger.ts";

// Component imports
import Dashboard from "@components/Dashboard";
import BookmarksView from "@components/BookmarksView";
import SettingsView from "@components/SettingsView";
import AuthScreen from "@components/AuthScreen";

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
 * Main application entry point with routing and state management
 */
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<string>("bookmarks");
  const [theme, setTheme] = useState<string>("dark");

  // Initialize app on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize DOM references
        initDom();

        // Load theme from localStorage
        const savedTheme = localStorage.getItem("anchormarks_theme") || "dark";
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);

        // Check authentication
        const { checkAuth, showMainApp } = await import(
          "@features/auth/auth.ts"
        );
        const isAuthed = await checkAuth();

        if (isAuthed) {
          setIsAuthenticated(true);
          const { loadSettings } = await import(
            "@features/bookmarks/settings.ts"
          );
          await loadSettings();

          // Load initial data
          const { updateUserInfo } = await import("@features/auth/auth.ts");
          const { loadFolders } = await import(
            "@features/bookmarks/folders.ts"
          );
          const { loadBookmarks } = await import(
            "@features/bookmarks/bookmarks.ts"
          );

          await Promise.all([
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
        }

        setCurrentView(state.currentView);
        setIsLoading(false);
      } catch (err) {
        logger.error("Failed to initialize app", err);
        setIsLoading(false);
      }
    };

    initializeApp();

    // Global keyboard shortcuts
    document.addEventListener("keydown", handleKeyboard);
    window.addEventListener("focus", () => {
      document.addEventListener("keydown", handleKeyboard);
    });

    return () => {
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  // Listen for view changes in state
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.currentView !== currentView) {
        setCurrentView(state.currentView);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentView]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "1.2rem",
          color: "var(--text-secondary)",
        }}
      >
        Loading AnchorMarks...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Render appropriate view
  return (
    <div className="app-container" data-theme={theme}>
      <div className="app-layout">
        {/* Sidebar - kept from existing structure */}
        <aside id="sidebar" className="sidebar">
          {/* Navigation will be populated by legacy JavaScript */}
        </aside>

        {/* Main content area */}
        <main id="main-content" className="main-content">
          {/* Header - will be populated by legacy components */}
          <div id="headers-container"></div>

          {/* Dynamic view content */}
          <div id="main-view" className="main-view">
            {currentView === "dashboard" && <Dashboard />}
            {currentView === "settings" && <SettingsView />}
            {[
              "bookmarks",
              "folder",
              "favorites",
              "recent",
              "archived",
              "collection",
              "tag-cloud",
              "search",
            ].includes(currentView) && <BookmarksView />}
          </div>
        </main>

        {/* Modals container */}
        <div id="modals-container"></div>
      </div>
    </div>
  );
};

// Export utility functions and global API
declare global {
  interface Window {
    AnchorMarks: any;
    launchBookmarkFromPalette: (id: string) => void;
    searchBookmarks: (query: string) => any[];
  }
}

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

// Global API exports
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
