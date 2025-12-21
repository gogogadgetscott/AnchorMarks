import { Header, Omnibar, Icon, Button } from "../components/index.ts";
import authScreen from "./fragments/auth-screen.html?raw";
import sidebar from "./fragments/sidebar.html?raw";
import mainContent from "./fragments/main-content.html?raw";
import bulkBar from "./fragments/bulk-bar.html?raw";
import emptyState from "./fragments/empty-state.html?raw";
import bookmarkModal from "./fragments/bookmark-modal.html?raw";
import tagModal from "./fragments/tag-modal.html?raw";
import folderModal from "./fragments/folder-modal.html?raw";
import filterSidebar from "./fragments/filter-sidebar.html?raw";
import settingsModal from "./fragments/settings-modal.html?raw";
import shortcutsPopup from "./fragments/shortcuts-popup.html?raw";
import commandPalette from "./fragments/quick-launch.html?raw";
import onboardingTour from "./fragments/onboarding-tour.html?raw";
import toast from "./fragments/toast.html?raw";

/**
 * Loads and injects HTML components into the DOM
 */
export function loadComponents(): void {
  const app = document.getElementById("app");
  if (!app) return;

  // Clear existing content to avoid duplicates if called multiple times
  app.innerHTML = "";

  // 1. Auth Screen
  const authContainer = document.createElement("div");
  authContainer.innerHTML = authScreen;
  if (authContainer.firstElementChild) {
    app.appendChild(authContainer.firstElementChild);
  }

  // 2. Main App Container
  const mainApp = document.createElement("div");
  mainApp.id = "main-app";
  mainApp.className = "main-app hidden";

  // Sidebar Backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "sidebar-backdrop";
  backdrop.id = "sidebar-backdrop";
  mainApp.appendChild(backdrop);

  // Sidebar
  const sidebarTemp = document.createElement("div");
  sidebarTemp.innerHTML = sidebar;
  if (sidebarTemp.firstElementChild) {
    mainApp.appendChild(sidebarTemp.firstElementChild);
  }

  // Main Content
  const contentTemp = document.createElement("div");
  contentTemp.innerHTML = mainContent;
  const mainContentEl = contentTemp.firstElementChild;

  if (mainContentEl) {
    // Inject Headers
    const headersContainer = mainContentEl.querySelector("#headers-container");
    if (headersContainer) {
      headersContainer.innerHTML = [
        // 1. Dashboard Header
        Header({
          id: "dashboard-header",
          title: "Dashboard",
          className: "dashboard-header",
          rightContent: `
            ${Button("Add Widget", { id: "dashboard-add-widget-btn", variant: "secondary", icon: "plus" })}
            ${Button("", { id: "dashboard-layout-btn", variant: "icon", icon: "grid", title: "Layout Settings" })}
            ${Button("", { id: "dashboard-fullscreen-btn", variant: "icon", icon: "external", title: "Toggle Fullscreen", className: "fullscreen-toggle" })}
          `,
          bulkActions: ["archive", "move", "tag", "delete"],
          clearBtnId: "clear-selection-btn",
          selectionCountId: "header-selection-count",
          countId: "dashboard-view-name"
        }),

        // 2. Bookmarks Header
        Header({
          id: "bookmarks-header",
          title: "Bookmarks",
          className: "bookmarks-header",
          countId: "bookmarks-view-count",
          countSuffix: "bookmarks",
          rightContent: `
            ${Omnibar({ id: "search-input" })}
            <button id="filter-dropdown-btn" class="btn btn-secondary" title="Filters">
              ${Icon("filter", { size: 16 })}
              <span class="filter-btn-text">Filters</span>
            </button>
          `,
          bulkActions: ["archive", "move", "tag", "delete"],
        }),

        // 3. Favorites Header
        Header({
          id: "favorites-header",
          title: "Favorites",
          className: "favorites-header",
          countId: "favorites-view-count",
          countSuffix: "favorites",
          rightContent: `
            <div class="sort-controls">
              <label for="favorites-sort">Sort by</label>
              <select id="favorites-sort" class="form-select">
                <option value="recently_added">Recently Added</option>
                <option value="most_visited">Most Visited</option>
                <option value="a_z">A – Z</option>
                <option value="z_a">Z – A</option>
              </select>
            </div>
          `,
          bulkActions: ["archive", "move", "tag", "delete"],
        }),

        // 4. Recents Header
        Header({
          id: "recents-header",
          title: "Recent",
          className: "recents-header",
          countId: "recents-view-count",
          countSuffix: "recent",
          rightContent: `
            <div class="time-range-controls">
              <label for="recents-range">Time Range</label>
              <select id="recents-range" class="form-select">
                <option value="today">Today</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
          `,
          bulkActions: ["archive", "move", "tag", "delete"],
        }),

        // 5. Archived Header
        Header({
          id: "archived-header",
          title: "Archived",
          className: "archived-header",
          countId: "archived-view-count",
          countSuffix: "bookmarks",
          rightContent: `
            <div class="header-search-bar">
              ${Icon("search", { size: 18 })}
              <input type="text" id="archived-search-input" placeholder="Search archived bookmarks..." />
              <kbd>Ctrl+K</kbd>
            </div>
          `,
          viewModes: ["grid", "list"],
          bulkActions: ["unarchive", "delete"],
        }),
      ].join("\n");
    }

    // Inject Bulk Bar
    const bulkBarContainer = mainContentEl.querySelector("#bulk-bar-container");
    if (bulkBarContainer) {
      bulkBarContainer.innerHTML = bulkBar;
    }

    // Inject Empty State
    const emptyStateContainer = mainContentEl.querySelector(
      "#empty-state-container",
    );
    if (emptyStateContainer) {
      emptyStateContainer.innerHTML = emptyState;
    }

    mainApp.appendChild(mainContentEl);
  }
  app.appendChild(mainApp);

  // 3. Modals and Overlays
  const modalsContainer = document.createElement("div");
  modalsContainer.id = "modals-container";
  modalsContainer.innerHTML = [
    bookmarkModal,
    tagModal,
    folderModal,
    filterSidebar,
    settingsModal,
    shortcutsPopup,
    commandPalette,
    onboardingTour,
    toast,
  ].join("\n");

  // Append all children of modalsContainer to app
  while (modalsContainer.firstChild) {
    app.appendChild(modalsContainer.firstChild);
  }
}
