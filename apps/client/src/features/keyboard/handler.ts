/**
 * AnchorMarks - Keyboard Handler Module
 * Handles global keyboard shortcuts and navigation
 */

import * as state from "@features/state.ts";
import { openOmnibar, closeOmnibar } from "@features/bookmarks/omnibar.ts";
import { openModal, updateActiveNav } from "@utils/ui-helpers.ts";

/**
 * Handle global keyboard events
 * Unified handler that integrates both old and new keyboard shortcut systems
 */
export async function handleKeyboard(e: KeyboardEvent): Promise<void> {
  // Early preventDefault for Ctrl+K / Cmd+K to stop browser address bar focus
  // This must happen BEFORE any async operations and synchronously
  const isCtrlK = (e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K");
  if (isCtrlK) {
    // Prevent browser from handling Ctrl+K
    e.preventDefault();
    // Handle it immediately and synchronously to avoid browser interference
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
    // Open omnibar asynchronously but after preventDefault
    openOmnibar();
    return; // Don't process through other handlers
  }

  // Try new keyboard shortcuts system first
  const { keyboardShortcuts } = await import("@utils/keyboard-shortcuts.ts");
  if (keyboardShortcuts.handleKeyPress(e)) {
    // Shortcut was handled by new system, return early
    return;
  }

  // Fall back to legacy keyboard handler for shortcuts not in new system
  const key = (e.key || "").toLowerCase();
  const modifier = e.ctrlKey || e.metaKey;

  // Escape key
  if (key === "escape") {
    if (state.bulkMode) {
      const { clearSelections } =
        await import("@features/bookmarks/bookmarks.ts");
      clearSelections();
    } else {
      // Close omnibar if open
      closeOmnibar();
    }
    return;
  }

  // Ctrl+N: Add new bookmark
  if (modifier && key === "n") {
    const activeEl = document.activeElement;
    if (!activeEl || !["INPUT", "TEXTAREA"].includes(activeEl.tagName)) {
      e.preventDefault();
      openModal("bookmark-modal");
    }
  }

  // Ctrl+F: Focus search (opens omnibar)
  if (modifier && key === "f") {
    const activeEl = document.activeElement;
    if (
      (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) ||
      e.shiftKey
    )
      return; // Shift+F is for favorites
    e.preventDefault();
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    searchInput?.focus();
    openOmnibar();
  }

  // Ctrl+K is handled early in the function to prevent browser address bar focus
  // (handled above before async operations)

  // Ctrl+Shift+P: Focus search with > prefix for commands (opens omnibar/search)
  if (modifier && e.shiftKey && key === "p") {
    e.preventDefault();
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.value = ">";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      openOmnibar();
    }
  }

  // Ctrl+A: Select all
  if (modifier && key === "a") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    const { selectAllBookmarks } =
      await import("@features/bookmarks/bookmarks.ts");
    selectAllBookmarks();
  }

  // Ctrl+1 to 9: Navigate to folders
  if (modifier && !e.shiftKey && key >= "1" && key <= "9") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    const { navigateToFolderByIndex } =
      await import("@features/bookmarks/folders.ts");
    navigateToFolderByIndex(parseInt(key) - 1);
  }

  // Ctrl+Shift+D: Dashboard
  if (modifier && e.shiftKey && key === "d") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentFolder(null);
    await switchView("dashboard");
  }

  // Ctrl+Shift+T: Tag Cloud
  if (modifier && e.shiftKey && key === "t") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentFolder(null);
    await switchView("tag-cloud");
  }

  // Ctrl+Shift+F: Favorites
  if (modifier && e.shiftKey && key === "f") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentFolder(null);
    await switchView("favorites");
  }

  // Ctrl+Shift+A: All bookmarks
  if (modifier && e.shiftKey && key === "a") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    await state.setCurrentView("all");
    state.setCurrentFolder(null);
    updateActiveNav();
    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Bookmarks";
    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
    loadBookmarks();
  }

  // F11: Toggle fullscreen (on dashboard)
  if (key === "f11" && state.currentView === "dashboard") {
    e.preventDefault();
    const { toggleFullscreen } =
      await import("@features/bookmarks/dashboard.ts");
    toggleFullscreen();
  }

  // ?: Shortcuts help (handled by keyboard-shortcuts.ts, but kept here as fallback)
  // This is now handled by the new keyboard shortcuts system, but we keep this
  // as a fallback in case the new system doesn't handle it
  if (key === "?" || e.key === "?") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    // Open settings modal to keyboard shortcuts tab
    openModal("settings-modal");
    setTimeout(() => {
      const shortcutsTab = document.querySelector(
        '[data-settings-tab="shortcuts"]',
      ) as HTMLElement;
      if (shortcutsTab) {
        shortcutsTab.click();
      }
    }, 100);
  }
}

/**
 * Shared view switching logic
 */
async function switchView(view: string): Promise<void> {
  await state.setCurrentView(view);
  updateActiveNav();

  // Update header content for the new view
  const { updateHeaderContent } = await import("@/App.ts");
  await updateHeaderContent();

  // Save current view to persist across refreshes
  const { saveSettings } = await import("@features/bookmarks/settings.ts");
  saveSettings({ current_view: view });

  if (view === "dashboard") {
    const { renderDashboard } =
      await import("@features/bookmarks/dashboard.ts");
    renderDashboard();
  } else if (view === "tag-cloud") {
    const { renderTagCloud } = await import("@features/bookmarks/tag-cloud.ts");
    await renderTagCloud();
  } else {
    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
    loadBookmarks();
  }
}
