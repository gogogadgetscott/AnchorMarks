/**
 * AnchorMarks - Keyboard Handler Module
 * Handles global keyboard shortcuts and navigation
 */

import * as state from "@features/state.ts";
import {
  openCommandPalette,
  closeCommandPalette,
  updateCommandPaletteActive,
  runActiveCommand,
  openShortcutsPopup,
  closeShortcutsPopup,
} from "@features/bookmarks/commands.ts";
import { openOmnibar } from "@features/bookmarks/omnibar.ts";
import { openModal, updateActiveNav } from "@utils/ui-helpers.ts";

/**
 * Handle global keyboard events
 */
export async function handleKeyboard(e: KeyboardEvent): Promise<void> {
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
      const { clearSelections } =
        await import("@features/bookmarks/bookmarks.ts");
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
      activeEl.id === "quick-launch-input"
    ) {
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

  // Ctrl+K: Focus search (opens omnibar)
  if (modifier && key === "k" && !state.commandPaletteOpen) {
    e.preventDefault();
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    searchInput?.focus();
    openOmnibar();
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
    switchView("dashboard");
  }

  // Ctrl+Shift+T: Tag Cloud
  if (modifier && e.shiftKey && key === "t") {
    const activeEl = document.activeElement;
    if (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) return;
    e.preventDefault();
    state.setCurrentFolder(null);
    switchView("tag-cloud");
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
    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
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
      document.activeElement.id === "quick-launch-input";
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

/**
 * Shared view switching logic
 */
async function switchView(view: string): Promise<void> {
  state.setCurrentView(view);
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
