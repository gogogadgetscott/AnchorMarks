/**
 * AnchorMarks - Main Application Entry Point
 * This file imports all modules and initializes the application.
 */

// Import state
import * as state from "@features/state.ts";

declare global {
  interface Window {
    AnchorMarks: any;
  }
}

// Import API
import { api } from "@services/api.ts";

// Import utilities
import { escapeHtml, getHostname, parseTagInput } from "@utils/index.ts";

// Import layout components


// Import auth functions
import {
  login,
  register,
  logout,
  checkAuth,
  showMainApp,
  updateUserInfo,
  updateProfile,
  updatePassword,
} from "@features/auth/auth.ts";

// Import settings
import {
  loadSettings,
  saveSettings,
  setTheme,
  applyFaviconSetting,
  toggleFavicons,
  toggleAiSuggestions,
  toggleSidebar,
  toggleSection,
  toggleIncludeChildBookmarks,
} from "@features/bookmarks/settings.ts";

// Import bookmark functions
import {
  loadBookmarks,
  renderBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  toggleFavorite,
  trackClick,
  editBookmark,
  filterByTag,
  selectAllBookmarks,
  clearSelections,
} from "@features/bookmarks/bookmarks.ts";

// Import folder functions
import {
  loadFolders,
  renderFolders,
  updateFolderParentSelect,
  createFolder,
  updateFolder,
  deleteFolder,
  editFolder,
  navigateToFolderByIndex,
} from "@features/bookmarks/folders.ts";

// Import dashboard functions
import {
  renderDashboard,
  filterDashboardBookmarks,
  toggleLayoutSettings,
} from "@features/bookmarks/dashboard.ts";

// Import search functions
import {
  renderSidebarTags,
  filterSidebarTags,
  showAllTags,
  loadTagStats,
  filterTagStats,
  renameTagAcross,
  updateTagRenameUndoButton,
  toggleFilterTag,
  toggleTagMode,
  renderActiveFilters,
  removeTagFilter,
  clearAllFilters,
  handleTagSubmit,
  createNewTag,
} from "@features/bookmarks/search.ts";

// Import bulk operations
import {
  bulkDelete,
  bulkFavorite,
  bulkMove,
  bulkAddTags,
  bulkRemoveTags,
} from "@features/bookmarks/bulk-ops.ts";

// Import import/export
import {
  importHtml,
  exportJson,
  exportHtml,
  exportDashboardViews,
  importDashboardViews,
} from "@features/bookmarks/import-export.ts";

// Import command palette
import {
  openCommandPalette,
  closeCommandPalette,
  renderCommandPaletteList,
  updateCommandPaletteActive,
  runActiveCommand,
  openShortcutsPopup,
  closeShortcutsPopup,
} from "@features/bookmarks/commands.ts";

// Import UI helpers (needed for global export)
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
  toggleFilterDropdown,
  updateFilterButtonVisibility,
  updateFilterButtonText,
} from "@features/bookmarks/filters.ts";

// Import tag input
import {
  initTagInput,
  loadTagsFromInput,
} from "@features/bookmarks/tag-input.ts";

// Import tour
import {
  startTour,
  skipTour,
  nextTourStep,
} from "@features/bookmarks/tour.ts";

// Import Smart Organization UI
import SmartOrg from "@features/bookmarks/smart-organization-ui.ts";

// Import widget picker
import {
  openWidgetPicker,
} from "@features/bookmarks/widget-picker.ts";

// Set view mode
function setViewMode(mode: string): void {
  state.setViewMode(mode as any);
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.viewMode === mode);
  });
  saveSettings({ view_mode: mode });
  renderBookmarks();
}

// Show all folders
function showAllFolders(): void {
  const btn = document.getElementById("folders-show-more");
  if (btn) btn.classList.add("hidden");
  renderFolders();
}

// API Key functions
async function regenerateApiKey(): Promise<void> {
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

function copyApiKey(): void {
  navigator.clipboard.writeText(state.currentUser?.api_key || "");
  showToast("API key copied!", "success");
}

// Reset Bookmarks
async function resetBookmarks(): Promise<void> {
  if (
    !confirm(
      "Reset all bookmarks? This will delete all your bookmarks and folders, and restore the example bookmarks. This cannot be undone!",
    )
  )
    return;

  try {
    const data = await api("/settings/reset-bookmarks", { method: "POST" });
    state.setCurrentFolder(null);
    state.setCurrentView("all");
    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Bookmarks";
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

// Initialize application
async function initializeApp(): Promise<void> {
  updateUserInfo();
  await Promise.all([loadFolders(), loadBookmarks()]);
  setViewMode(state.viewMode);
  initFilterDropdown();
  updateFilterButtonVisibility();

  // Initialize sidebar filter controls with current state
  const settingsTagSort = document.getElementById("settings-tag-sort") as HTMLSelectElement;
  if (settingsTagSort)
    settingsTagSort.value = state.filterConfig.tagSort || "count_desc";
}

// Keyboard handler
function handleKeyboard(e: KeyboardEvent): void {
  const key = (e.key || "").toLowerCase();
  const modifier = e.ctrlKey || e.metaKey;

  // Escape key
  if (key === "escape") {
    const shortcutsPopup = document.getElementById("shortcuts-popup");
    if (shortcutsPopup && !shortcutsPopup.classList.contains("hidden")) {
      e.preventDefault();
      closeShortcutsPopup();
    } else if (state.commandPaletteOpen) {
      e.preventDefault();
      closeCommandPalette();
    } else if (state.bulkMode) {
      clearSelections();
    }
    return;
  }

  // Ctrl+N: Add new bookmark
  if (modifier && key === "n") {
    const activeEl = document.activeElement;
    if (
      !activeEl ||
      !["INPUT", "TEXTAREA"].includes(activeEl.tagName) ||
      activeEl.id === "command-palette-input"
    ) {
      e.preventDefault();
      openModal("bookmark-modal");
    }
  }

  // Ctrl+F: Focus search
  if (modifier && key === "f") {
    const activeEl = document.activeElement;
    if (
      (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) ||
      e.shiftKey
    )
      return; // Shift+F is for favorites
    e.preventDefault();
    document.getElementById("search-input")?.focus();
  }

  // Ctrl+K: Focus search
  if (modifier && key === "k" && !state.commandPaletteOpen) {
    e.preventDefault();
    document.getElementById("search-input")?.focus();
  }

  // Ctrl+Shift+P: Command palette
  if (modifier && e.shiftKey && key === "p") {
    e.preventDefault();
    if (state.commandPaletteOpen) {
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
  }

  // Ctrl+A: Select all
  if (modifier && key === "a") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    selectAllBookmarks();
  }

  // Ctrl+1 to 9: Navigate to folders
  if (modifier && !e.shiftKey && key >= "1" && key <= "9") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    navigateToFolderByIndex(parseInt(key) - 1);
  }

  // Ctrl+Shift+D: Dashboard
  if (modifier && e.shiftKey && key === "d") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentFolder(null);
    switchView("dashboard");
  }

  async function switchView(view: string): Promise<void> {
    state.setCurrentView(view);
    updateActiveNav();

    // Save current view to persist across refreshes
    await saveSettings({ current_view: view });

    if (state.currentView === "dashboard") {
      const { renderDashboard } = await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      const { loadBookmarks } =
        await import("@features/bookmarks/bookmarks.ts");
      loadBookmarks();
    }
  }
  // Ctrl+Shift+F: Favorites
  if (modifier && e.shiftKey && key === "f") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentFolder(null);
    updateActiveNav();
    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Favorites";
    loadBookmarks();
  }

  // Ctrl+Shift+A: All bookmarks
  if (modifier && e.shiftKey && key === "a") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentView("all");
    state.setCurrentFolder(null);
    updateActiveNav();
    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Bookmarks";
    loadBookmarks();
  }

  // ?: Shortcuts help
  if (key === "?" || e.key === "?") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    openShortcutsPopup();
  }

  // Command palette navigation (avoid double-handling when input is focused)
  if (state.commandPaletteOpen) {
    const isPaletteInputFocused =
      document.activeElement &&
      document.activeElement.id === "command-palette-input";
    if (!isPaletteInputFocused) {
      if (key === "arrowdown") {
        e.preventDefault();
        updateCommandPaletteActive(1);
      } else if (key === "arrowup") {
        e.preventDefault();
        updateCommandPaletteActive(-1);
      } else if (key === "pagedown") {
        e.preventDefault();
        updateCommandPaletteActive(5);
      } else if (key === "pageup") {
        e.preventDefault();
        updateCommandPaletteActive(-5);
      } else if (key === "home") {
        e.preventDefault();
        const delta = -state.commandPaletteActiveIndex;
        updateCommandPaletteActive(delta);
      } else if (key === "end") {
        e.preventDefault();
        const delta =
          state.commandPaletteEntries.length -
          1 -
          state.commandPaletteActiveIndex;
        updateCommandPaletteActive(delta);
      } else if (key === "enter") {
        e.preventDefault();
        runActiveCommand();
      }
    }
  }
}

// ============================================================
// Event Listeners
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize DOM references
  initDom();

  // Initial theme load from localStorage (for immediate visual feedback)
  const savedTheme = localStorage.getItem("anchormarks_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    const themeSelect = document.getElementById("theme-select") as HTMLSelectElement;
    if (themeSelect) themeSelect.value = savedTheme;
  }

  // Check authentication
  const isAuthed = await checkAuth();
  if (isAuthed) {
    await loadSettings();
    showMainApp();
    await initializeApp();
    // Initialize smart organization features only when authenticated
    SmartOrg.init();
    // Initialize tag input with autocomplete
    initTagInput();
  }

  // Auth tabs
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".auth-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const loginForm = document.getElementById("login-form");
      if (loginForm) loginForm.classList.toggle("hidden", (tab as HTMLElement).dataset.tab !== "login");
      const registerForm = document.getElementById("register-form");
      if (registerForm) registerForm.classList.toggle("hidden", (tab as HTMLElement).dataset.tab !== "register");
    });
  });

  // Auth forms
  document
    .getElementById("login-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const emailEl = document.getElementById("login-email") as HTMLInputElement;
      const passEl = document.getElementById("login-password") as HTMLInputElement;
      const email = emailEl?.value || "";
      const password = passEl?.value || "";
      if (await login(email, password)) {
        await loadSettings();
        await initializeApp();
      }
    });

  document
    .getElementById("register-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const emailEl = document.getElementById("register-email") as HTMLInputElement;
      const passEl = document.getElementById("register-password") as HTMLInputElement;
      const email = emailEl?.value || "";
      const password = passEl?.value || "";
      if (await register(email, password)) {
        await loadSettings();
        await initializeApp();
      }
    });

  // Navigation
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", () => {
      state.setCurrentView((item as HTMLElement).dataset.view || "all");
      // Leaving collection view should clear the active collection selection
      if ((item as HTMLElement).dataset.view !== "collection") {
        state.setCurrentCollection(null);
      }
      // Don't clear current folder - treat it as a filter
      state.setDisplayedCount(state.BOOKMARKS_PER_PAGE);
      updateActiveNav();
      renderActiveFilters();
      updateFilterButtonVisibility();

      if ((item as HTMLElement).dataset.view === "dashboard") {
        renderDashboard();
      } else {
        loadBookmarks();
      }
    });
  });

  // Search
  let searchTimeout: ReturnType<typeof setTimeout> | undefined;
  document.getElementById("search-input")?.addEventListener("input", () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    state.setDisplayedCount(state.BOOKMARKS_PER_PAGE);
    searchTimeout = setTimeout(() => {
      renderBookmarks();
      updateFilterButtonText();
    }, 300);
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboard);

  // Robustness: rebind/ensure shortcuts after tab focus returns
  window.addEventListener("focus", () => {
    // If handler was removed or page lost focus, ensure it's attached
    document.addEventListener("keydown", handleKeyboard);
  });

  // Filter controls
  document.getElementById("filter-sort")?.addEventListener("change", (e) => {
    state.filterConfig.sort = (e.target as HTMLSelectElement).value;
    renderBookmarks();
  });

  document.getElementById("filter-tag-sort")?.addEventListener("change", () => {
    renderActiveFilters();
  });

  document
    .getElementById("filter-tag-search")
    ?.addEventListener("input", () => {
      renderActiveFilters();
    });

  // Tag Sort in Settings
  document
    .getElementById("settings-tag-sort")
    ?.addEventListener("change", (e) => {
      state.filterConfig.tagSort = (e.target as HTMLSelectElement).value;
      // Also update the filter dropdown if it exists
      const filterTagSort = document.getElementById("filter-tag-sort");
      if (filterTagSort) (filterTagSort as HTMLSelectElement).value = (e.target as HTMLSelectElement).value;

      // Save to settings to persist
      saveSettings({ tag_sort: (e.target as HTMLSelectElement).value });

      // Re-render things that depend on tag sort
      renderSidebarTags();
      loadTagStats(); // Update the tag overview list in Settings > Tags
    });

  // Tag Search in Settings
  document
    .getElementById("tag-search-input")
    ?.addEventListener("input", (e) => {
      filterTagStats((e.target as HTMLInputElement).value);
    });

  // Bulk actions
  document
    .getElementById("bulk-delete-btn")
    ?.addEventListener("click", bulkDelete);
  document
    .getElementById("bulk-favorite-btn")
    ?.addEventListener("click", bulkFavorite);
  document.getElementById("bulk-move-btn")?.addEventListener("click", bulkMove);
  document
    .getElementById("bulk-clear-btn")
    ?.addEventListener("click", clearSelections);
  document
    .getElementById("bulk-tag-btn")
    ?.addEventListener("click", bulkAddTags);
  document
    .getElementById("bulk-untag-btn")
    ?.addEventListener("click", bulkRemoveTags);

  // Command palette
  const commandPaletteInput = document.getElementById("command-palette-input");
  commandPaletteInput?.addEventListener("input", () =>
    renderCommandPaletteList((commandPaletteInput as HTMLInputElement).value || ""),
  );
  commandPaletteInput?.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      updateCommandPaletteActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      updateCommandPaletteActive(-1);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      updateCommandPaletteActive(5);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      updateCommandPaletteActive(-5);
    } else if (e.key === "Home") {
      e.preventDefault();
      const delta = -state.commandPaletteActiveIndex;
      updateCommandPaletteActive(delta);
    } else if (e.key === "End") {
      e.preventDefault();
      const delta =
        state.commandPaletteEntries.length -
        1 -
        state.commandPaletteActiveIndex;
      updateCommandPaletteActive(delta);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActiveCommand();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
    }
  });

  document
    .getElementById("command-palette-list")
    ?.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(".command-item");
      if (!item) return;
      const idx = parseInt((item as HTMLElement).dataset.index || "0", 10);
      if (!Number.isNaN(idx)) {
        state.setCommandPaletteActiveIndex(idx);
        runActiveCommand();
      }
    });

  document.getElementById("command-palette")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("command-palette-backdrop")) {
      closeCommandPalette();
    }
  });

  // Shortcuts popup
  document
    .getElementById("shortcuts-popup-close")
    ?.addEventListener("click", closeShortcutsPopup);
  document.getElementById("shortcuts-popup")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeShortcutsPopup();
  });

  // Add Bookmark buttons
  const resetAndOpenBookmarkModal = () => {
    const modalTitle = document.getElementById("bookmark-modal-title");
    if (modalTitle) modalTitle.textContent = "Add Bookmark";
    (document.getElementById("bookmark-form") as HTMLFormElement).reset();
    loadTagsFromInput(""); // Clear tags
    openModal("bookmark-modal");
  };

  document.getElementById("add-bookmark-btn")?.addEventListener("click", resetAndOpenBookmarkModal);
  document.getElementById("sidebar-add-bookmark-btn")?.addEventListener("click", resetAndOpenBookmarkModal);
  document.getElementById("empty-add-btn")?.addEventListener("click", resetAndOpenBookmarkModal);


  // Bookmark Form
  document.getElementById("bookmark-form")?.addEventListener("submit", (e: Event) => {
    e.preventDefault();
    const idEl = document.getElementById("bookmark-id") as HTMLInputElement;
    const tagsEl = document.getElementById("bookmark-tags") as HTMLInputElement;
    const urlEl = document.getElementById("bookmark-url") as HTMLInputElement;
    const titleEl = document.getElementById("bookmark-title") as HTMLInputElement;
    const descEl = document.getElementById("bookmark-description") as HTMLInputElement;
    const folderEl = document.getElementById("bookmark-folder") as HTMLSelectElement;

    const id = idEl?.value;
    const tagsValue = tagsEl?.value;
    console.log("[Bookmark Form] Tags value:", tagsValue);
    const data = {
      url: urlEl?.value,
      title: titleEl?.value || undefined,
      description: descEl?.value || undefined,
      folder_id: folderEl?.value || undefined,
      tags: tagsValue || undefined,
    };
    console.log("[Bookmark Form] Submitting data:", data);

    if (id) {
      updateBookmark(id, data);
    } else {
      createBookmark(data);
    }
  });

  document
    .getElementById("bookmark-new-folder-btn")
    ?.addEventListener("click", async () => {
      const name = prompt("New folder name:");
      const trimmed = name ? name.trim() : "";
      if (!trimmed) return;

      const folder = await createFolder(
        { name: trimmed, color: "#6366f1", parent_id: null },
        { closeModal: false },
      );

      if (folder?.id) {
        (document.getElementById("bookmark-folder") as HTMLSelectElement).value = folder.id;
      }
    });

  // Fetch Metadata Button
  document
    .getElementById("fetch-metadata-btn")
    ?.addEventListener("click", async () => {
      const urlInput = document.getElementById("bookmark-url") as HTMLInputElement;
      const url = urlInput?.value.trim();

      if (!url) {
        showToast("Please enter a URL first", "warning");
        urlInput?.focus();
        return;
      }

      try {
        new URL(url);
      } catch {
        showToast("Please enter a valid URL", "error");
        return;
      }

      const btn = document.getElementById("fetch-metadata-btn");
      if (!btn) return;

      const originalContent = btn.innerHTML;
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            Fetching...
      `;

      try {
        const metadata = await api("/bookmarks/fetch-metadata", {
          method: "POST",
          body: JSON.stringify({ url }),
        });

        const titleInput = document.getElementById("bookmark-title") as HTMLInputElement;
        if (titleInput && !titleInput.value && metadata.title) {
          titleInput.value = metadata.title;
        }

        const descInput = document.getElementById("bookmark-description") as HTMLInputElement;
        if (descInput && !descInput.value && metadata.description) {
          descInput.value = metadata.description;
        }

        showToast("Metadata fetched successfully!", "success");
      } catch (err) {
        showToast((err as Error).message || "Failed to fetch metadata", "error");
      } finally {
        (btn as HTMLButtonElement).disabled = false;
        (btn as HTMLButtonElement).innerHTML = originalContent;
      }
    });

  // Add Folder
  document.getElementById("add-folder-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const modalTitle = document.getElementById("folder-modal-title");
    if (modalTitle) modalTitle.textContent = "New Folder";
    (document.getElementById("folder-form") as HTMLFormElement).reset();
    const idInput = document.getElementById("folder-id") as HTMLInputElement;
    if (idInput) idInput.value = "";
    const colorInput = document.getElementById("folder-color") as HTMLInputElement;
    if (colorInput) colorInput.value = "#6366f1";

    // Reset button text
    const form = document.getElementById("folder-form");
    if (form) {
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.textContent = "Create Folder";
    }

    updateFolderParentSelect();
    openModal("folder-modal");
  });

  // Folder Form
  document.getElementById("folder-form")?.addEventListener("submit", (e: Event) => {
    e.preventDefault();
    const idEl = document.getElementById("folder-id") as HTMLInputElement;
    const nameEl = document.getElementById("folder-name") as HTMLInputElement;
    const colorEl = document.getElementById("folder-color") as HTMLInputElement;
    const parentEl = document.getElementById("folder-parent") as HTMLSelectElement;

    const id = idEl?.value;
    const data = {
      name: nameEl?.value,
      color: colorEl?.value,
      parent_id: parentEl?.value || null,
    };

    if (id) {
      updateFolder(id, data);
    } else {
      createFolder(data);
    }
  });

  // Color Picker
  document.querySelectorAll(".color-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".color-option")
        .forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      const colorInput = document.getElementById("folder-color") as HTMLInputElement;
      if (colorInput) colorInput.value = (opt as HTMLElement).dataset.color || "#6366f1";
    });
  });

  // View Mode
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setViewMode((btn as HTMLElement).dataset.viewMode || "grid"));
  });

  // Sidebar toggle buttons for all views
  document
    .getElementById("toggle-sidebar-btn")
    ?.addEventListener("click", toggleSidebar);
  document
    .getElementById("toggle-sidebar-btn-bookmarks")
    ?.addEventListener("click", toggleSidebar);
  document
    .getElementById("toggle-sidebar-btn-favorites")
    ?.addEventListener("click", toggleSidebar);
  document
    .getElementById("toggle-sidebar-btn-recents")
    ?.addEventListener("click", toggleSidebar);

  // Mobile sidebar backdrop - close sidebar when clicking backdrop
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

  // Close overlays/modals on Escape key
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    // Close mobile sidebar if open
    if (window.innerWidth <= 768) {
      document.body.classList.remove("mobile-sidebar-open");
    }
    // Close any open modal (e.g., settings modal)
    closeModals();
  });

  // Close mobile sidebar when window is resized to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      document.body.classList.remove("mobile-sidebar-open");
    }
  });

  // Dashboard-specific controls
  document
    .getElementById("dashboard-add-widget-btn")
    ?.addEventListener("click", () => {
      openWidgetPicker();
    });

  document
    .getElementById("dashboard-layout-btn")
    ?.addEventListener("click", () => {
      toggleLayoutSettings();
    });

  // Bookmarks-specific controls
  const filterBtn = document.getElementById("bookmarks-filter-btn");
  filterBtn?.addEventListener("click", () => {
    toggleFilterDropdown();
  });

  // Favorites-specific controls
  document.getElementById("favorites-sort")?.addEventListener("change", (e: Event) => {
    state.filterConfig.sort = (e.target as HTMLSelectElement).value;
    renderBookmarks();
  });

  // Recents-specific controls
  document.getElementById("recents-range")?.addEventListener("change", () => {
    // Filter by time range - will need to implement range filtering
    loadBookmarks();
  });

  // Settings
  document.getElementById("settings-btn")?.addEventListener("click", () => {
    openModal("settings-modal");
  });

  document.querySelectorAll(".settings-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".settings-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".settings-panel")
        .forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document
        .getElementById(`settings-${(tab as HTMLElement).dataset.settingsTab}`)
        ?.classList.add("active");

      if ((tab as HTMLElement).dataset.settingsTab === "tags") loadTagStats();
    });
  });

  document
    .getElementById("theme-select")
    ?.addEventListener("change", (e: Event) => setTheme((e.target as HTMLSelectElement).value));
  document
    .getElementById("hide-favicons-toggle")
    ?.addEventListener("change", toggleFavicons);
  document
    .getElementById("ai-suggestions-toggle")
    ?.addEventListener("change", toggleAiSuggestions);
  document
    .getElementById("include-children-toggle")
    ?.addEventListener("change", toggleIncludeChildBookmarks);
  document
    .getElementById("toggle-sidebar-btn")
    ?.addEventListener("click", toggleSidebar);
  applyFaviconSetting();

  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document
    .getElementById("copy-api-key")
    ?.addEventListener("click", copyApiKey);
  document
    .getElementById("regenerate-api-key")
    ?.addEventListener("click", regenerateApiKey);
  document
    .getElementById("reset-bookmarks-btn")
    ?.addEventListener("click", resetBookmarks);
  document.getElementById("restart-tour-btn")?.addEventListener("click", () => {
    localStorage.removeItem("anchormarks_tour_dismissed");
    state.setIsInitialLoad(true);
    closeModals();
    setTimeout(() => {
      startTour();
    }, 150);
    showToast("Onboarding tour restarted", "success");
  });

  // Profile Settings
  document
    .getElementById("profile-email-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const emailInput = document.getElementById("profile-email") as HTMLInputElement;
      const email = emailInput.value;
      if (await updateProfile(email)) {
        emailInput.value = "";
      }
    });

  document
    .getElementById("profile-password-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const currentPassInput = document.getElementById("profile-current-password") as HTMLInputElement;
      const newPassInput = document.getElementById("profile-new-password") as HTMLInputElement;
      const currentPassword = currentPassInput.value;
      const newPassword = newPassInput.value;
      if (await updatePassword(currentPassword, newPassword)) {
        currentPassInput.value = "";
        newPassInput.value = "";
      }
    });

  // Tag Editor
  document
    .getElementById("tag-form")
    ?.addEventListener("submit", handleTagSubmit);

  document.querySelectorAll(".color-option-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".color-option-tag")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tagColorInput = document.getElementById("tag-color") as HTMLInputElement;
      if (tagColorInput) tagColorInput.value = (btn as HTMLElement).dataset.color || "#f59e0b";
    });
  });

  // Import/Export
  document.getElementById("import-html-btn")?.addEventListener("click", () => {
    document.getElementById("import-html-file")?.click();
  });
  document
    .getElementById("import-html-file")
    ?.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) importHtml(target.files[0]);
    });
  document
    .getElementById("export-json-btn")
    ?.addEventListener("click", exportJson);
  document
    .getElementById("export-html-btn")
    ?.addEventListener("click", exportHtml);

  // Dashboard Views Export/Import
  document
    .getElementById("export-dashboard-views-btn")
    ?.addEventListener("click", exportDashboardViews);
  document
    .getElementById("import-dashboard-views-btn")
    ?.addEventListener("click", () => {
      document.getElementById("import-dashboard-views-file")?.click();
    });
  document
    .getElementById("import-dashboard-views-file")
    ?.addEventListener("change", (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) importDashboardViews(target.files[0]);
    });

  // Tag rename
  document
    .getElementById("tag-rename-btn")
    ?.addEventListener("click", async () => {
      const fromInput = document.getElementById("tag-rename-from") as HTMLInputElement;
      const toInput = document.getElementById("tag-rename-to") as HTMLInputElement;
      const from = fromInput?.value.trim();
      const to = toInput?.value.trim();
      if (!from || !to) {
        showToast("Enter both tags to rename", "error");
        return;
      }
      if (!confirm(`Rename tag "${from}" to "${to}"?`)) return;
      try {
        await renameTagAcross(from, to);
      } catch (err: any) {
        showToast(err.message || "Rename failed", "error");
      }
    });

  document
    .getElementById("tag-rename-undo-btn")
    ?.addEventListener("click", async () => {
      if (!state.lastTagRenameAction) return;
      const { from, to } = state.lastTagRenameAction;
      if (!confirm(`Undo rename ${from} → ${to}?`)) return;
      try {
        await renameTagAcross(to, from);
        state.setLastTagRenameAction(null);
        updateTagRenameUndoButton();
        showToast("Undo complete", "success");
      } catch (err: any) {
        showToast(err.message || "Undo failed", "error");
      }
    });

  // Add new tag
  document
    .getElementById("add-new-tag-btn")
    ?.addEventListener("click", async () => {
      const nameInput = document.getElementById("new-tag-name") as HTMLInputElement;
      const colorInput = document.getElementById("new-tag-color") as HTMLInputElement;

      const name = nameInput?.value.trim();
      const color = colorInput?.value || "#f59e0b";

      if (!name) {
        showToast("Please enter a tag name", "error");
        nameInput?.focus();
        return;
      }

      const success = await createNewTag(name, color);

      if (success) {
        // Clear the input fields
        if (nameInput) nameInput.value = "";
        if (colorInput) colorInput.value = "#f59e0b";
        nameInput?.focus();
      }
    });

  // Enter key support for new tag input
  document.getElementById("new-tag-name")?.addEventListener("keypress", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("add-new-tag-btn")?.click();
    }
  });

  // Sidebar tag search
  document
    .getElementById("sidebar-tag-search")
    ?.addEventListener("input", (e: Event) => {
      filterSidebarTags((e.target as HTMLInputElement).value);
    });

  document
    .getElementById("tags-show-more")
    ?.addEventListener("click", showAllTags);
  document
    .getElementById("folders-show-more")
    ?.addEventListener("click", showAllFolders);

  // Section Toggles
  document.querySelectorAll("[data-toggle-section]").forEach((header) => {
    header.addEventListener("click", () => {
      toggleSection((header as HTMLElement).dataset.toggleSection || "");
    });
  });

  // Note: Tag suggestions from URL are handled by SmartOrg.init()

  // Modal Close
  document
    .querySelectorAll(".modal-backdrop, .modal-close, .modal-cancel")
    .forEach((el) => {
      el.addEventListener("click", closeModals);
    });

  document.querySelectorAll(".modal-content").forEach((content) => {
    content.addEventListener("click", (e) => e.stopPropagation());
  });

  // Global Event Delegation
  document.body.addEventListener("input", (e: Event) => {
    const target = (e.target as HTMLElement).closest("[data-action]") as HTMLElement;
    if (!target) return;

    if (target.dataset.action === "filter-dashboard-bookmarks") {
      filterDashboardBookmarks((target as HTMLInputElement).value);
    }
  });

  document.body.addEventListener("click", (e: Event) => {
    const target = (e.target as HTMLElement).closest("[data-action]") as HTMLElement;
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id || "";
    const tag = target.dataset.tag || "";
    const modal = target.dataset.modalTarget;

    switch (action) {
      case "clear-filters":
        clearAllFilters();
        break;
      case "open-modal":
        if (modal) openModal(modal);
        break;
      case "track-click":
        if (id) trackClick(id);
        break;
      case "open-bookmark":
        e.stopPropagation();
        if (target.dataset.url) {
          window.open(target.dataset.url, "_blank");
          const bookmarkId = state.bookmarks.find(
            (b) => b.url === target.dataset.url,
          )?.id;
          if (bookmarkId) trackClick(bookmarkId);
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
        if (id) toggleFavorite(id);
        break;
      case "edit-bookmark":
        e.stopPropagation();
        if (id) editBookmark(id);
        break;
      case "delete-bookmark":
        e.stopPropagation();
        if (id) deleteBookmark(id);
        break;
      case "filter-by-tag":
        e.stopPropagation();
        if (tag) filterByTag(tag);
        break;
      case "edit-folder":
        e.stopPropagation();
        if (id) editFolder(id);
        break;
      case "delete-folder":
        e.stopPropagation();
        if (id) deleteFolder(id);
        break;
      case "remove-tag-filter":
        if (tag) removeTagFilter(tag);
        break;
      case "clear-search":
        const searchInput = document.getElementById("search-input") as HTMLInputElement;
        if (searchInput) {
          searchInput.value = "";
          state.filterConfig.search = "";
          renderBookmarks();
        }
        break;
      case "clear-folder-filter":
        state.setCurrentFolder(null);
        state.setCurrentCollection(null);
        state.setCurrentView("all");
        updateActiveNav();
        document.getElementById("view-title").textContent = "Bookmarks";
        renderActiveFilters();
        loadBookmarks();
        break;
      case "clear-collection-filter":
        state.setCurrentCollection(null);
        state.setCurrentView("all");
        updateActiveNav();
        document.getElementById("view-title").textContent = "Bookmarks";
        renderActiveFilters();
        loadBookmarks();
        break;
      case "toggle-filter-tag":
        e.stopPropagation();
        if (tag) toggleFilterTag(tag);
        break;
      case "toggle-tag-mode":
        e.stopPropagation();
        toggleTagMode();
        break;

      case "skip-tour":
        skipTour();
        break;
      case "bulk-select-all":
        selectAllBookmarks();
        break;
      case "bulk-unselect-all":
        clearSelections();
        break;
    }
  });

  // Tour next button
  document
    .getElementById("tour-next-btn")
    ?.addEventListener("click", nextTourStep);
});

// ============================================================
// Global API Export (for external modules and debugging)
// ============================================================

window.AnchorMarks = {
  // API
  api: api,

  // Auth
  isAuthenticated: () => state.isAuthenticated,

  // State getters/setters
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

  // UI Functions
  showToast,
  openModal,
  closeModals,

  // Utility Functions
  escapeHtml,
  getHostname,
  parseTagInput,
  addTagToInput,

  // Data Functions
  loadBookmarks,
  loadFolders,
  renderBookmarks,
  renderDashboard,
  renderFolders,

  // Settings
  saveSettings,
  loadSettings,
};

// Function to launch bookmark from command palette
function launchBookmarkFromPalette(bookmarkId: string): void {
  // Logic to launch the bookmark
  const bookmark = state.bookmarks.find((b) => b.id === bookmarkId);
  if (bookmark) {
    window.open(bookmark.url, "_blank");
  }
}

// Integrate search into command palette
function searchBookmarks(query: string): any[] {
  return state.bookmarks.filter(
    (b) => b.title.includes(query) || b.url.includes(query),
  );
}

// Make globally available
(window as any).launchBookmarkFromPalette = launchBookmarkFromPalette;
(window as any).searchBookmarks = searchBookmarks;
