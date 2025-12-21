/**
 * AnchorMarks - Navigation UI Module
 * Handles sidebar, view switching, and navigation-related event listeners
 */

import * as state from "@features/state.ts";
import { updateActiveNav, closeModals } from "@utils/ui-helpers.ts";

/**
 * Initialize navigation-related event listeners
 */
export function initNavigationListeners(): void {
  // Navigation item clicks (View switching)
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", async () => {
      const view = (item as HTMLElement).dataset.view || "all";
      state.setCurrentView(view);
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
        renderTagCloud();
      } else {
        const { loadBookmarks } =
          await import("@features/bookmarks/bookmarks.ts");
        loadBookmarks();
      }
    });
  });

  // Sidebar toggle buttons (Multiple IDs exist for different headers)
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

  // Mobile sidebar backdrop
  document.getElementById("sidebar-backdrop")?.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      document.body.classList.remove("mobile-sidebar-open");
    }
  });

  // Close mobile sidebar when clicking on navigation items
  document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
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
    if (window.innerWidth > 768) {
      document.body.classList.remove("mobile-sidebar-open");
    }
  });

  // Close overlays on Escape (Mobile sidebar + Modals)
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (window.innerWidth <= 768) {
      document.body.classList.remove("mobile-sidebar-open");
    }
    closeModals();
  });
}
