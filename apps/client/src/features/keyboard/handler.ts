/**
 * AnchorMarks - Keyboard Handler Module
 * Handles global keyboard shortcuts and navigation
 */

import { openOmnibar, closeOmnibar } from "@features/bookmarks/omnibar.ts";
import { openModal } from "@utils/ui-helpers.ts";
import { getBookmarksBridge, getUIBridge } from "@/contexts/context-bridge";

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

  // Early handler for '/' to open omnibar outside text inputs.
  // This is handled synchronously to prevent browser quick-find behavior.
  const isSlashShortcut =
    !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key === "/";
  if (isSlashShortcut) {
    const activeEl = document.activeElement as HTMLElement | null;
    const isTypingInField =
      !!activeEl &&
      (["INPUT", "TEXTAREA"].includes(activeEl.tagName) ||
        activeEl.isContentEditable);

    if (!isTypingInField) {
      e.preventDefault();
      const searchInput = document.getElementById(
        "search-input",
      ) as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
      openOmnibar();
      return;
    }
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
    if (getBookmarksBridge().getBulkMode()) {
      getBookmarksBridge().setSelectedBookmarks(new Set());
      getBookmarksBridge().setBulkMode(false);
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
    getUIBridge().setCurrentFolder(null);
    await switchView("dashboard");
  }

  // Ctrl+Shift+T: Tag Cloud
  if (modifier && e.shiftKey && key === "t") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    getUIBridge().setCurrentFolder(null);
    await switchView("tag-cloud");
  }

  // Ctrl+Shift+F: Favorites
  if (modifier && e.shiftKey && key === "f") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    getUIBridge().setCurrentFolder(null);
    await switchView("favorites");
  }

  // Ctrl+Shift+A: All bookmarks
  if (modifier && e.shiftKey && key === "a") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    getUIBridge().setCurrentFolder(null);
    await switchView("all");
  }

  // F11: Toggle fullscreen (on dashboard)
  if (key === "f11" && getUIBridge().getCurrentView() === "dashboard") {
    e.preventDefault();
    const { toggleFullscreen } =
      await import("@features/bookmarks/dashboard.ts");
    toggleFullscreen();
  }

  // ?: Shortcuts help (handled by keyboard-shortcuts.ts, but kept here as fallback)
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
  await getUIBridge().setCurrentView(view);

  // Save current view to persist across refreshes
  const { saveSettings } = await import("@features/bookmarks/settings.ts");
  saveSettings({ current_view: view });

  if (view !== "dashboard") {
    await getBookmarksBridge().loadBookmarks();
  }
  // Dashboard component handles its own rendering via React
}
