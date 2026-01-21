/**
 * AnchorMarks - Navigation UI Module
 * Handles sidebar, view switching, and navigation-related event listeners
 */

import * as state from "@features/state.ts";
import { updateActiveNav, closeModals } from "@utils/ui-helpers.ts";

/**
 * Attach sidebar toggle listener to dynamically rendered headers
 * Should be called after header re-renders
 */
export function attachSidebarToggle(): void {
  // Find any toggle-sidebar-btn-* button
  const toggleBtn = document.querySelector('[id^="toggle-sidebar-btn-"]');
  if (toggleBtn && !(toggleBtn as any)._sidebarListenerAttached) {
    toggleBtn.addEventListener("click", async () => {
      const { toggleSidebar } = await import("@features/bookmarks/settings.ts");
      toggleSidebar();
    });
    // Mark as attached to prevent duplicate listeners
    (toggleBtn as any)._sidebarListenerAttached = true;
  }
}

/**
 * Initialize navigation-related event listeners
 */
export function initNavigationListeners(): void {
  // Navigation item clicks (View switching)
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", async () => {
      const view = (item as HTMLElement).dataset.view || "all";
      state.setCurrentView(view);

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
      } else {
        const { loadBookmarks } =
          await import("@features/bookmarks/bookmarks.ts");
        loadBookmarks();
      }
    });
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
    document.getElementById(id)?.addEventListener("click", async () => {
      const { toggleSidebar } = await import("@features/bookmarks/settings.ts");
      toggleSidebar();
    });
  });

  // Attach sidebar toggle for dynamically rendered headers
  attachSidebarToggle();

  // Mobile sidebar backdrop
  document.getElementById("sidebar-backdrop")?.addEventListener("click", () => {
    if (window.innerWidth <= 1024) {
      document.body.classList.remove("mobile-sidebar-open");
    }
  });

  // Close mobile sidebar when clicking on navigation items
  document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }
    });
  });

  // Section Toggles
  document.querySelectorAll("[data-toggle-section]").forEach((header) => {
    header.addEventListener("click", async () => {
      const { toggleSection } = await import("@features/bookmarks/settings.ts");
      toggleSection((header as HTMLElement).dataset.toggleSection || "");
    });
  });

  // Tour next button
  document
    .getElementById("tour-next-btn")
    ?.addEventListener("click", async () => {
      const { nextTourStep } = await import("@features/bookmarks/tour.ts");
      nextTourStep();
    });

  // Global resize listener for mobile sidebar state
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024) {
      document.body.classList.remove("mobile-sidebar-open");
    }
  });

  // Close overlays on Escape (Mobile sidebar + Modals)
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (window.innerWidth <= 1024) {
      document.body.classList.remove("mobile-sidebar-open");
    }
    closeModals();
  });
}
