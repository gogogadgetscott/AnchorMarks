import authScreen from "./fragments/auth-screen.html?raw";
import sidebar from "./fragments/sidebar.html?raw";
import mainContent from "./fragments/main-content.html?raw";
import dashboardHeader from "./fragments/dashboard-header.html?raw";
import bookmarksHeader from "./fragments/bookmarks-header.html?raw";
import favoritesHeader from "./fragments/favorites-header.html?raw";
import recentsHeader from "./fragments/recents-header.html?raw";
import bulkBar from "./fragments/bulk-bar.html?raw";
import emptyState from "./fragments/empty-state.html?raw";
import bookmarkModal from "./fragments/bookmark-modal.html?raw";
import tagModal from "./fragments/tag-modal.html?raw";
import folderModal from "./fragments/folder-modal.html?raw";
import filterSidebar from "./fragments/filter-sidebar.html?raw";
import settingsModal from "./fragments/settings-modal.html?raw";
import shortcutsPopup from "./fragments/shortcuts-popup.html?raw";
import commandPalette from "./fragments/command-palette.html?raw";
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
        dashboardHeader,
        bookmarksHeader,
        favoritesHeader,
        recentsHeader,
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
