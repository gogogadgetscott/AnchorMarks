/**
 * AnchorMarks - Interactions Module
 * Handles global event delegation, favicon management, and bulk actions
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import {
  showToast,
  openModal,
  closeModals,
  updateActiveNav,
} from "@utils/ui-helpers.ts";
import { escapeHtml, getHostname, parseTagInput } from "@utils/index.ts";

/**
 * Initialize interaction-related listeners
 */
export function initInteractions(): void {
  initGlobalDelegation();
  initFaviconErrorHandling();
  initAuthTabListeners();
  initImportExportListeners();
  
  // Directly attach user dropdown listeners as fallback
  attachUserDropdownDirectly();
}

/**
 * Attach user dropdown listeners directly to elements
 */
export function attachUserDropdownDirectly(): void {
  // Avatar button - always reattach when called
  const avatarBtn = document.querySelector(
    "[data-action='toggle-user-dropdown']",
  ) as HTMLElement | null;
  if (avatarBtn) {
    avatarBtn.onclick = (e: Event) => {
      e.stopPropagation();
      toggleUserDropdown();
    };
  }

  // Settings button
  const settingsBtn = document.querySelector(
    "[data-action='open-settings']",
  ) as HTMLElement | null;
  if (settingsBtn) {
    settingsBtn.onclick = (e: Event) => {
      e.stopPropagation();
      openModal("settings-modal");
      closeUserDropdown();
    };
  }

  // Logout button
  const logoutBtn = document.querySelector(
    "[data-action='logout-user']",
  ) as HTMLElement | null;
  if (logoutBtn) {
    logoutBtn.onclick = (e: Event) => {
      e.stopPropagation();
      import("@features/auth/auth.ts").then(({ logout }) => logout());
      closeUserDropdown();
    };
  }
}

/**
 * Handle Auth Tabs (Login/Register toggle)
 */
function initAuthTabListeners(): void {
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".auth-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const loginForm = document.getElementById("login-form");
      if (loginForm)
        loginForm.classList.toggle(
          "hidden",
          (tab as HTMLElement).dataset.tab !== "login",
        );
      const registerForm = document.getElementById("register-form");
      if (registerForm)
        registerForm.classList.toggle(
          "hidden",
          (tab as HTMLElement).dataset.tab !== "register",
        );
    });
  });
}

/**
 * Handle Import/Export button clicks
 */
function initImportExportListeners(): void {
  // Import HTML
  document.getElementById("import-html-btn")?.addEventListener("click", () => {
    document.getElementById("import-html-file")?.click();
  });
  document
    .getElementById("import-html-file")
    ?.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        import("@features/bookmarks/import-export.ts").then(({ importHtml }) =>
          importHtml(file),
        );
        target.value = "";
      }
    });

  // Export Buttons
  document.getElementById("export-json-btn")?.addEventListener("click", () => {
    import("@features/bookmarks/import-export.ts").then(({ exportJson }) =>
      exportJson(),
    );
  });
  document.getElementById("export-html-btn")?.addEventListener("click", () => {
    import("@features/bookmarks/import-export.ts").then(({ exportHtml }) =>
      exportHtml(),
    );
  });

  // Dashboard Export/Import
  document
    .getElementById("export-dashboard-views-btn")
    ?.addEventListener("click", () => {
      import("@features/bookmarks/import-export.ts").then(
        ({ exportDashboardViews }) => exportDashboardViews(),
      );
    });
  document
    .getElementById("import-dashboard-views-btn")
    ?.addEventListener("click", () => {
      document.getElementById("import-dashboard-views-file")?.click();
    });
  document
    .getElementById("import-dashboard-views-file")
    ?.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        import("@features/bookmarks/import-export.ts").then(
          ({ importDashboardViews }) => importDashboardViews(target.files![0]),
        );
      }
    });
}

/**
 * Global Event Delegation (Click and Input)
 */
function initGlobalDelegation(): void {
  // Global Input Delegation
  document.body.addEventListener("input", (e: Event) => {
    const target = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement;
    if (!target) return;

    if (target.dataset.action === "filter-dashboard-bookmarks") {
      import("@features/bookmarks/dashboard.ts").then(
        ({ filterDashboardBookmarks }) =>
          filterDashboardBookmarks((target as HTMLInputElement).value),
      );
    }
  });

  // Global Click Delegation
  document.body.addEventListener("click", async (e: Event) => {
    const target = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement;
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id || "";
    const tag = target.dataset.tag || "";
    const modal = target.dataset.modalTarget;

    switch (action) {
      case "clear-filters":
        import("@features/bookmarks/search.ts").then(({ clearAllFilters }) =>
          clearAllFilters(),
        );
        break;
      case "open-modal":
        if (modal) openModal(modal);
        break;
      case "track-click":
        if (id) {
          import("@features/bookmarks/bookmarks.ts").then(({ trackClick }) =>
            trackClick(id),
          );
        }
        break;
      case "open-bookmark":
        e.stopPropagation();
        if (target.dataset.url) {
          window.open(target.dataset.url, "_blank");
          const bookmarkId = state.bookmarks.find(
            (b) => b.url === target.dataset.url,
          )?.id;
          if (bookmarkId) {
            import("@features/bookmarks/bookmarks.ts").then(({ trackClick }) =>
              trackClick(bookmarkId),
            );
          }
        }
        break;
      case "copy-link":
        e.stopPropagation();
        if (target.dataset.url) {
          navigator.clipboard
            .writeText(target.dataset.url)
            .then(() => {
              showToast("Link copied to clipboard", "success");
            })
            .catch(() => {
              showToast("Failed to copy link", "error");
            });
        }
        break;
      case "toggle-favorite":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/bookmarks.ts").then(
            ({ toggleFavorite }) => toggleFavorite(id),
          );
        break;
      case "edit-bookmark":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/bookmarks.ts").then(({ editBookmark }) =>
            editBookmark(id),
          );
        break;
      case "delete-bookmark":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/bookmarks.ts").then(
            ({ deleteBookmark }) => deleteBookmark(id),
          );
        break;
      case "archive-bookmark":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/bookmarks.ts").then(
            ({ archiveBookmark }) => archiveBookmark(id),
          );
        break;
      case "unarchive-bookmark":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/bookmarks.ts").then(
            ({ unarchiveBookmark }) => unarchiveBookmark(id),
          );
        break;
      case "filter-by-tag":
        e.stopPropagation();
        if (tag)
          import("@features/bookmarks/bookmarks.ts").then(({ filterByTag }) =>
            filterByTag(tag),
          );
        break;
      case "edit-folder":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/folders.ts").then(({ editFolder }) =>
            editFolder(id),
          );
        break;
      case "delete-folder":
        e.stopPropagation();
        if (id)
          import("@features/bookmarks/folders.ts").then(({ deleteFolder }) =>
            deleteFolder(id),
          );
        break;
      case "remove-tag-filter":
        if (tag)
          import("@features/bookmarks/search.ts").then(({ removeTagFilter }) =>
            removeTagFilter(tag),
          );
        break;
      case "clear-search":
        const searchInput = document.getElementById(
          "search-input",
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.value = "";
          state.filterConfig.search = "";
          import("@features/bookmarks/bookmarks.ts").then(
            ({ renderBookmarks }) => renderBookmarks(),
          );
        }
        break;
      case "toggle-widget-picker":
        e.stopPropagation();
        import("@features/bookmarks/widget-picker.ts").then(
          ({ toggleWidgetPicker }) => toggleWidgetPicker(),
        );
        break;
      case "clear-folder-filter":
        state.setCurrentFolder(null);
        state.setCurrentCollection(null);
        state.setCurrentView("all");
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Bookmarks";
        import("@features/bookmarks/search.ts").then(
          ({ renderActiveFilters }) => renderActiveFilters(),
        );
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
        break;
      case "clear-collection-filter":
        state.setCurrentCollection(null);
        state.setCurrentView("all");
        updateActiveNav();
        const viewTitleEl = document.getElementById("view-title");
        if (viewTitleEl) viewTitleEl.textContent = "Bookmarks";
        import("@features/bookmarks/search.ts").then(
          ({ renderActiveFilters }) => renderActiveFilters(),
        );
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
        break;
      case "toggle-filter-tag":
        e.stopPropagation();
        if (tag)
          import("@features/bookmarks/search.ts").then(({ toggleFilterTag }) =>
            toggleFilterTag(tag),
          );
        break;
      case "toggle-tag-mode":
        e.stopPropagation();
        import("@features/bookmarks/search.ts").then(({ toggleTagMode }) =>
          toggleTagMode(),
        );
        break;
      case "skip-tour":
        import("@features/bookmarks/tour.ts").then(({ skipTour }) =>
          skipTour(),
        );
        break;
      case "bulk-select-all":
        import("@features/bookmarks/bookmarks.ts").then(
          ({ selectAllBookmarks }) => selectAllBookmarks(),
        );
        break;
      case "bulk-unselect-all":
        import("@features/bookmarks/bookmarks.ts").then(({ clearSelections }) =>
          clearSelections(),
        );
        break;
      case "toggle-user-dropdown":
        e.stopPropagation();
        toggleUserDropdown();
        break;
      case "open-settings":
        e.stopPropagation();
        openModal("settings-modal");
        closeUserDropdown();
        break;
      case "logout-user":
        e.stopPropagation();
        import("@features/auth/auth.ts").then(({ logout }) => logout());
        closeUserDropdown();
        break;
    }
  });

  // Bulk action buttons (Standard IDs)
  initBulkActionListeners();
}

/**
 * Handle specific bulk action buttons not covered by delegation
 */
function initBulkActionListeners(): void {
  // Bulk action buttons
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest(".btn-icon, .btn-secondary, .dropdown-item");
    if (!btn) return;

    if (
      btn.classList.contains("btn-bulk-delete") ||
      btn.id === "bulk-delete-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkDelete());
    } else if (
      btn.classList.contains("btn-bulk-favorite") ||
      btn.id === "bulk-favorite-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkFavorite());
    } else if (
      btn.classList.contains("btn-bulk-move") ||
      btn.id === "bulk-move-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkMove());
    } else if (
      btn.classList.contains("btn-clear-selection") ||
      btn.id === "bulk-clear-btn" ||
      btn.id === "clear-selection-btn"
    ) {
      import("@features/bookmarks/bookmarks.ts").then(({ clearSelections }) =>
        clearSelections(),
      );
    } else if (
      btn.classList.contains("btn-bulk-tag") ||
      btn.id === "bulk-tag-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkAddTags());
    } else if (
      btn.classList.contains("btn-bulk-untag") ||
      btn.id === "bulk-untag-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkRemoveTags());
    } else if (
      btn.classList.contains("btn-bulk-archive") ||
      btn.id === "bulk-archive-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkArchive());
    } else if (
      btn.classList.contains("btn-bulk-unarchive") ||
      btn.id === "bulk-unarchive-btn"
    ) {
      import("@features/bookmarks/bulk-ops.ts").then((m) => m.bulkUnarchive());
    }
  });
}

/**
 * Toggle user dropdown menu visibility
 */
function toggleUserDropdown(): void {
  const dropdown = document.querySelector(
    ".user-dropdown-menu",
  ) as HTMLElement | null;
  if (dropdown) {
    dropdown.classList.toggle("hidden");
    
    if (!dropdown.classList.contains("hidden")) {
      // Dropdown is now open - add click-outside listener
      setTimeout(() => {
        document.addEventListener("click", handleUserDropdownClickOutside);
      }, 0);
    } else {
      // Dropdown is now closed - remove click-outside listener
      document.removeEventListener("click", handleUserDropdownClickOutside);
    }
  }
}

/**
 * Close user dropdown menu
 */
function closeUserDropdown(): void {
  const dropdown = document.querySelector(
    ".user-dropdown-menu",
  ) as HTMLElement | null;
  if (dropdown) {
    dropdown.classList.add("hidden");
    document.removeEventListener("click", handleUserDropdownClickOutside);
  }
}

/**
 * Handle clicks outside the user dropdown
 */
function handleUserDropdownClickOutside(e: Event): void {
  const dropdown = document.querySelector(".user-dropdown-menu");
  const userAvatar = document.querySelector(".header-user-avatar-btn");
  
  if (
    dropdown &&
    !dropdown.contains(e.target as Node) &&
    !userAvatar?.contains(e.target as Node)
  ) {
    closeUserDropdown();
  }
}

/**
 * Global Error Handler for broken favicons
 */
function initFaviconErrorHandling(): void {
  const faviconRefreshQueue: Array<{ id: string; target: HTMLImageElement }> =
    [];
  let faviconRefreshRunning = false;

  async function processFaviconQueue() {
    if (faviconRefreshRunning || faviconRefreshQueue.length === 0) return;
    faviconRefreshRunning = true;

    while (faviconRefreshQueue.length > 0) {
      const item = faviconRefreshQueue.shift();
      if (!item) continue;
      try {
        const res = await api(`/bookmarks/${item.id}/refresh-favicon`, {
          method: "POST",
        });
        if (res && res.favicon && item.target.parentElement) {
          const parent = item.target.parentElement;
          if (parent && parent.classList.contains("bookmark-favicon")) {
            parent.innerHTML = `<img src="${res.favicon}?t=${Date.now()}" alt="" class="bookmark-favicon-img" loading="lazy">`;
          }
        }
      } catch {
        // Silently fail - fallback is already shown
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    faviconRefreshRunning = false;
  }

  document.addEventListener(
    "error",
    (e) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLImageElement &&
        target.classList.contains("bookmark-favicon-img")
      ) {
        const iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon icon-link" style="width: 24px; height: 24px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
        if (target.parentElement) {
          target.parentElement.innerHTML = iconHtml;
        }
        if (target.dataset.retryAttempted !== "true") {
          target.dataset.retryAttempted = "true";
          const card = target.closest(".bookmark-card") as HTMLElement;
          const id = card?.dataset.id;
          if (id) {
            faviconRefreshQueue.push({ id, target });
            processFaviconQueue();
          }
        }
      }
    },
    true,
  );
}
