/**
 * AnchorMarks - Navigation UI Module
 * Handles sidebar, view switching, and navigation-related event listeners
 */

import * as state from "@features/state.ts";
import { updateActiveNav, closeModals } from "@utils/ui-helpers.ts";

let resizeListenerAttached = false;
let escapeListenerAttached = false;

/**
 * Attach sidebar toggle listener to dynamically rendered headers
 * Should be called after header re-renders
 */
export function attachSidebarToggle(): void {
  // Find any toggle-sidebar-btn-* button
  const toggleBtn = document.querySelector('[id^="toggle-sidebar-btn-"]');
  if (
    toggleBtn &&
    !(toggleBtn as HTMLElement & { _sidebarListenerAttached?: boolean })
      ._sidebarListenerAttached
  ) {
    toggleBtn.addEventListener("click", async () => {
      const { toggleSidebar } = await import("@features/bookmarks/settings.ts");
      toggleSidebar();
    });
    // Mark as attached to prevent duplicate listeners
    (
      toggleBtn as HTMLElement & { _sidebarListenerAttached?: boolean }
    )._sidebarListenerAttached = true;
  }
}

/**
 * Initialize navigation-related event listeners
 */
export function initNavigationListeners(): void {
  // Navigation item clicks (View switching)
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    const navItem = item as HTMLElement & {
      _navViewListenerAttached?: boolean;
    };
    if (navItem._navViewListenerAttached) return;

    navItem.addEventListener("click", async () => {
      const view = (item as HTMLElement).dataset.view || "all";
      await state.setCurrentView(view);

      // Update header content for the new view
      const { updateHeaderContent } = await import("@/App.ts");
      updateHeaderContent();

      updateActiveNav();

      // Save view preference
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      saveSettings({ current_view: view });

      if (view === "dashboard") {
        const { renderDashboard } =
          await import("@features/bookmarks/dashboard.ts");
        renderDashboard();
      } else if (view === "tag-cloud") {
        const { renderTagCloud } =
          await import("@features/bookmarks/tag-cloud.ts");
        await renderTagCloud();
      } else if (view === "analytics") {
        const { renderAnalytics } = await import("@features/analytics.ts");
        await renderAnalytics();
      } else {
        const { renderSkeletons, loadBookmarks } =
          await import("@features/bookmarks/bookmarks.ts");
        renderSkeletons();
        await loadBookmarks();
      }
    });
    navItem._navViewListenerAttached = true;
  });

  // Sidebar toggle buttons (now just one toggle for the main header)
  const sidebarToggleIds = [
    "toggle-sidebar-btn-dashboard",
    "toggle-sidebar-btn-bookmarks",
    "toggle-sidebar-btn-favorites",
    "toggle-sidebar-btn-recents",
    "toggle-sidebar-btn-archived",
  ];

  sidebarToggleIds.forEach((id) => {
    const btn = document.getElementById(id) as
      | (HTMLElement & { _sidebarToggleListenerAttached?: boolean })
      | null;
    if (!btn || btn._sidebarToggleListenerAttached) return;

    btn.addEventListener("click", async () => {
      const { toggleSidebar } = await import("@features/bookmarks/settings.ts");
      toggleSidebar();
    });
    btn._sidebarToggleListenerAttached = true;
  });

  // Attach sidebar toggle for dynamically rendered headers
  attachSidebarToggle();

  // Mobile sidebar backdrop
  const backdrop = document.getElementById("sidebar-backdrop") as
    | (HTMLElement & { _mobileBackdropListenerAttached?: boolean })
    | null;
  if (backdrop && !backdrop._mobileBackdropListenerAttached) {
    backdrop.addEventListener("click", () => {
      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }
    });
    backdrop._mobileBackdropListenerAttached = true;
  }

  // Close mobile sidebar when clicking on navigation items
  document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
    const navItem = item as HTMLElement & {
      _mobileNavCloseListenerAttached?: boolean;
    };
    if (navItem._mobileNavCloseListenerAttached) return;

    navItem.addEventListener("click", () => {
      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }
    });
    navItem._mobileNavCloseListenerAttached = true;
  });

  // Section Toggles
  document.querySelectorAll("[data-toggle-section]").forEach((header) => {
    const toggleHeader = header as HTMLElement & {
      _toggleSectionListenerAttached?: boolean;
    };
    if (toggleHeader._toggleSectionListenerAttached) return;

    toggleHeader.addEventListener("click", async () => {
      const { toggleSection } = await import("@features/bookmarks/settings.ts");
      toggleSection((header as HTMLElement).dataset.toggleSection || "");
    });
    toggleHeader._toggleSectionListenerAttached = true;
  });

  // Tour next button
  const tourNextBtn = document.getElementById("tour-next-btn") as
    | (HTMLElement & { _tourNextListenerAttached?: boolean })
    | null;
  if (tourNextBtn && !tourNextBtn._tourNextListenerAttached) {
    tourNextBtn.addEventListener("click", async () => {
      const { nextTourStep } = await import("@features/bookmarks/tour.ts");
      nextTourStep();
    });
    tourNextBtn._tourNextListenerAttached = true;
  }

  // Global resize listener for mobile sidebar state
  if (!resizeListenerAttached) {
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }
    });
    resizeListenerAttached = true;
  }

  // Close overlays on Escape (Mobile sidebar + Modals)
  if (!escapeListenerAttached) {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }
      closeModals();
    });
    escapeListenerAttached = true;
  }
}
