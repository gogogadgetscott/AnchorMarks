import { Header, Omnibar, Icon } from "../components/index.ts";
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
    // Inject Single Dynamic Header
    const headersContainer = mainContentEl.querySelector("#headers-container");
    if (headersContainer) {
      // Render initial header for default view (all/bookmarks)
      headersContainer.innerHTML = Header({
        id: "main-header",
        title: "Bookmarks",
        className: "main-header",
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
      });
      // Attach view-toggle listeners after header render
      import("@/App.ts").then(({ attachViewToggleListeners }) =>
        attachViewToggleListeners(),
      );
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

/**
 * Re-loads the auth form elements into the DOM if they were removed
 */
export function loadAuthScreenForms(): void {
  const authScreenEl = document.getElementById("auth-screen");
  if (!authScreenEl) return;

  // If forms are missing, re-add them to the auth screen
  if (
    !document.getElementById("login-form") ||
    !document.getElementById("register-form")
  ) {
    const formContainer = document.createElement("div");
    formContainer.innerHTML = authScreen;
    const authScreenContent = authScreenEl.querySelector(
      ".auth-screen-content",
    );
    if (authScreenContent && formContainer.firstElementChild) {
      authScreenContent.innerHTML = formContainer.firstElementChild.innerHTML;
    }
  }
}
