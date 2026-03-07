/**
 * AnchorMarks - Main Application Entry Point
 * This file imports all modules and initializes the application.
 */

// Import state
import * as state from "@features/state.ts";

declare global {
  interface Window {
    AnchorMarks: Record<string, unknown>;
    launchBookmarkFromPalette: (id: string) => void;
    searchBookmarks: (query: string) => any[];
  }
}

// Import API
import { api } from "@services/api.ts";

// Import utilities
import {
  escapeHtml,
  getHostname,
  parseTagInput,
  safeLocalStorage,
} from "@utils/index.ts";
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
import type { ConfirmDialogOptions, HeaderConfig } from "./types/index";

// ============================================================
// New Modular UI Listeners (Moved to dynamic imports)
// ============================================================
// Moved to dynamic imports in DOMContentLoaded or as-needed
const confirmDialog = (msg: string, opts?: ConfirmDialogOptions) =>
  import("@features/ui/confirm-dialog.ts").then((m) =>
    m.confirmDialog(msg, opts),
  );

/**
 * Set view mode (grid / list / compact)
 */
export async function setViewMode(mode: string, save = true): Promise<void> {
  state.setViewMode(mode as "grid" | "list" | "compact");
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
    btn.removeEventListener(
      "click",
      (btn as HTMLElement & { _viewToggleHandler?: EventListener })
        ._viewToggleHandler!,
    );
    const handler = async (e: Event) => {
      e.preventDefault();
      const mode = (btn as HTMLElement).dataset.viewMode;
      if (mode) await setViewMode(mode);
    };
    (
      btn as HTMLElement & { _viewToggleHandler?: EventListener }
    )._viewToggleHandler = handler;
    btn.addEventListener("click", handler);
  });
}

/**
 * Update header content based on current view
 * This dynamically renders the header without fully re-rendering
 */
export async function updateHeaderContent(): Promise<void> {
  const { Omnibar, Button, Header } = await import("@components/index.ts");
  const headersContainer = document.getElementById("headers-container");
  if (!headersContainer) return;

  const headerConfig: HeaderConfig & { title: string } = {
    id: "main-header",
    className: "main-header",
    title: "Bookmarks",
    bulkActions: ["archive", "move", "tag", "auto-tag", "delete"],
  };

  // Customize header based on current view
  switch (state.currentView) {
    case "dashboard":
      headerConfig.title = "Dashboard";
      headerConfig.countId = "dashboard-view-name";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.showViewToggle = false;
      headerConfig.rightContent = `
        ${Button("Add Widget", { id: "dashboard-add-widget-btn", variant: "secondary", icon: "plus", data: { action: "toggle-widget-picker" } })}
        <button type="button" id="views-btn" class="btn btn-secondary" title="Dashboard Views" aria-label="Dashboard views">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          Views
        </button>
        ${Button("", { id: "dashboard-layout-btn", variant: "icon", icon: "grid", title: "Layout Settings", data: { action: "toggle-layout-settings" } })}
      `;
      headerConfig.bulkActions = ["archive", "move", "tag", "delete"];
      break;

    case "favorites":
      headerConfig.title = "Favorites";
      headerConfig.countId = "favorites-view-count";
      headerConfig.countSuffix = "favorites";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.rightContent = `
          <div class="sort-controls">
            <label for="favorites-sort">Sort by</label>
            <select id="favorites-sort" class="form-select">
              <option value="recently_added">Recently Added</option>
              <option value="most_visited">Most Visited</option>
              <option value="a_z">A – Z</option>
              <option value="z_a">Z – A</option>
            </select>
          </div>
        `;
      headerConfig.bulkActions = ["archive", "move", "tag", "delete"];
      break;

    case "recent":
      headerConfig.title = "Recent";
      headerConfig.countId = "recents-view-count";
      headerConfig.countSuffix = "recent";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.rightContent = `
          <div class="time-range-controls">
            <label for="recents-range">Time Range</label>
            <select id="recents-range" class="form-select">
              <option value="today">Today</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        `;
      break;

    case "most-used":
      headerConfig.title = "Most Used";
      headerConfig.countId = "most-used-view-count";
      headerConfig.countSuffix = "links";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.bulkActions = ["archive", "move", "tag", "delete"];
      break;

    case "archived":
      headerConfig.title = "Archived";
      headerConfig.countId = "archived-view-count";
      headerConfig.countSuffix = "bookmarks";
      headerConfig.centerContent = `${Omnibar({ id: "search-input", placeholder: "Search archived bookmarks..." })}`;
      headerConfig.bulkActions = ["unarchive", "delete"];
      break;

    case "collection":
      headerConfig.title = `Collection: ${state.currentCollection}`;
      headerConfig.countId = "collection-view-count";
      headerConfig.countSuffix = "bookmarks";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.showFilterButton = true;
      break;

    case "tag-cloud":
      headerConfig.title = "Tag Cloud";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      break;

    case "analytics":
      headerConfig.title = "Analytics";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.showViewToggle = false;
      headerConfig.showAddButton = false;
      break;

    case "all":
    case "folder":
    default:
      headerConfig.title = "Bookmarks";
      headerConfig.countId = "bookmarks-view-count";
      headerConfig.countSuffix = "bookmarks";
      headerConfig.centerContent = `${Omnibar({ id: "search-input" })}`;
      headerConfig.showFilterButton = true;
      break;
  }

  // Render the header with the configured options
  headersContainer.innerHTML = Header(headerConfig);

  // Ensure user profile reflects the logged-in user after re-render
  if (state.currentUser) {
    const { updateUserInfo } = await import("@features/auth/auth.ts");
    updateUserInfo();
  }

  // Re-attach listeners after header update
  attachViewToggleListeners();
  initFilterDropdown();
  updateFilterButtonVisibility();

  // Re-attach sidebar toggle listener
  const { attachSidebarToggle } = await import("@features/ui/navigation.ts");
  attachSidebarToggle();

  // Dashboard header: direct listeners so Add Widget and Layout buttons work after header replace
  if (state.currentView === "dashboard") {
    const addWidgetBtn = document.getElementById("dashboard-add-widget-btn");
    if (addWidgetBtn) {
      addWidgetBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        import("@features/bookmarks/widget-picker.ts").then(
          ({ toggleWidgetPicker }) => toggleWidgetPicker(),
        );
      });
    }
    const layoutBtn = document.getElementById("dashboard-layout-btn");
    if (layoutBtn) {
      layoutBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        import("@features/bookmarks/dashboard.ts").then(
          ({ toggleLayoutSettings }) => toggleLayoutSettings(),
        );
      });
    }

    // views button logic lives in dashboard module; make sure the
    // component initializes now that the DOM element exists
    import("@features/bookmarks/dashboard.ts").then(({ initDashboardViews }) =>
      initDashboardViews(),
    );
  }

  // Re-attach Omnibar listeners since header was replaced
  const { initOmnibarListeners } = await import("@features/ui/omnibar.ts");
  const { initInteractions } = await import("@features/ui/interactions.ts");
  const { initTagListeners } = await import("@features/ui/tags.ts");

  initOmnibarListeners(); // Call it here since header was replaced

  // Re-attach other listeners that might be affected by header/content changes
  initInteractions();
  initTagListeners();
}

/**
 * API Key functions
 */
export async function regenerateApiKey(): Promise<void> {
  if (
    !(await confirmDialog("Regenerate API key? Old keys will stop working.", {
      title: "Regenerate API Key",
      confirmText: "Regenerate",
      destructive: true,
    }))
  )
    return;
  try {
    const data = await api<{ api_key: string }>("/auth/regenerate-key", {
      method: "POST",
    });
    if (state.currentUser) state.currentUser.api_key = data.api_key;
    const apiKeyEl = document.getElementById("api-key-value");
    if (apiKeyEl) apiKeyEl.textContent = data.api_key;
    showToast("API key regenerated!", "success");
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
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
  if (
    !(await confirmDialog("Reset all bookmarks? This cannot be undone!", {
      title: "Reset Bookmarks",
      confirmText: "Reset All",
      destructive: true,
    }))
  )
    return;
  try {
    const data = await api<{ bookmarks_created: number }>(
      "/settings/reset-bookmarks",
      { method: "POST" },
    );
    state.setCurrentFolder(null);
    await state.setCurrentView("all");
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
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

/**
 * Fetch and display app version
 */
async function updateAppVersion(): Promise<void> {
  try {
    const response = await api<{ version: string }>("/health");
    const versionEl = document.getElementById("app-version");
    if (versionEl && response.version) {
      versionEl.textContent = `v${response.version}`;
    }
  } catch (error) {
    logger.warn("Failed to fetch app version", error);
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
  await Promise.all([loadFolders(), loadBookmarks(), updateAppVersion()]);

  // Update header based on current view before rendering
  await updateHeaderContent();

  if (state.currentView === "dashboard") {
    const { renderDashboard, initDashboardViews } =
      await import("@features/bookmarks/dashboard.ts");
    // header has already been built by this point but some callers
    // (initializeApp) call renderDashboard directly without going
    // through updateHeaderContent; ensure the views button is wired up
    await initDashboardViews();
    renderDashboard();
  } else if (state.currentView === "tag-cloud") {
    const { renderTagCloud } = await import("@features/bookmarks/tag-cloud.ts");
    await renderTagCloud();
  } else if (state.currentView === "analytics") {
    const { renderAnalytics } = await import("@features/analytics.ts");
    await renderAnalytics();
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
  const savedTheme = safeLocalStorage.getItem("anchormarks_theme");
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
    // Dynamically load Smart Organization
    import("@features/bookmarks/smart-organization-ui.ts").then((mod) =>
      mod.default.init(),
    );
    initTagInput();
    // Dynamically load Maintenance
    import("@features/maintenance.ts").then(({ initMaintenance }) =>
      initMaintenance(),
    );
  }

  // Initialize modular listeners
  const [
    { initNavigationListeners },
    { initFormListeners },
    { initInteractions },
    { initTagListeners },
    { handleKeyboard },
  ] = await Promise.all([
    import("@features/ui/navigation.ts"),
    import("@features/ui/forms.ts"),
    import("@features/ui/interactions.ts"),
    import("@features/ui/tags.ts"),
    import("@features/keyboard/handler.ts"),
  ]);

  initNavigationListeners();
  initFormListeners();

  // Only call initOmnibarListeners here if NOT authenticated, since
  // updateHeaderContent() already attaches listeners when authenticated
  if (!isAuthed) {
    const { initOmnibarListeners } = await import("@features/ui/omnibar.ts");
    initOmnibarListeners();
  }
  initInteractions();
  initTagListeners();

  // Global keyboard shortcuts with cleanup support
  const { registerGlobalCleanup } = await import("@utils/event-cleanup.ts");
  const globalSignal = registerGlobalCleanup();

  // Use capture phase to intercept browser shortcuts (like Ctrl+K) before browser handles them
  document.addEventListener("keydown", handleKeyboard, {
    capture: true,
    signal: globalSignal.signal,
  });

  // Filter sort listener (kept here for now as it's simple)
  document.getElementById("filter-sort")?.addEventListener(
    "change",
    (e) => {
      state.filterConfig.sort = (e.target as HTMLSelectElement).value;
      import("@features/bookmarks/bookmarks.ts").then(({ renderBookmarks }) =>
        renderBookmarks(),
      );
    },
    { signal: globalSignal.signal },
  );
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
  /** Use await AnchorMarks.setCurrentView(val) to switch views; the property setter is not used (setCurrentView is async). */
  setCurrentView: state.setCurrentView,
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
  saveSettings: async (settings: Record<string, unknown>) => {
    const { saveSettings } = await import("@features/bookmarks/settings.ts");
    saveSettings(settings);
  },
  loadSettings: async () => {
    const { loadSettings } = await import("@features/bookmarks/settings.ts");
    loadSettings();
  },
};
