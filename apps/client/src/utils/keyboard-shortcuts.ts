/**
 * Keyboard shortcuts system
 * Integrates with existing settings modal keyboard shortcuts page
 */

import { showToast } from "./ui-helpers.ts";
import * as state from "@features/state.ts";

interface Shortcut {
  key: string;
  description: string;
  category: string;
  handler: () => void | Promise<void>;
  global?: boolean; // Can be triggered from anywhere
  preventDefault?: boolean;
}

class KeyboardShortcuts {
  private shortcuts: Map<string, Shortcut> = new Map();
  private sequenceBuffer: string[] = [];
  private sequenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly SEQUENCE_TIMEOUT_MS = 1000; // 1 second to complete sequence

  constructor() {
    this.init();
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: Shortcut): void {
    const key = shortcut.key.toLowerCase();
    this.shortcuts.set(key, shortcut);
  }

  /**
   * Initialize keyboard shortcuts system
   * Note: Does NOT register event listeners - use handleKeyPress() from existing handler
   */
  init(): void {
    // Register default shortcuts
    this.registerDefaultShortcuts();
  }

  /**
   * Register default shortcuts
   */
  registerDefaultShortcuts(): void {
    // Search
    this.register({
      key: "k",
      description: "Focus search",
      category: "Navigation",
      global: true,
      handler: () => {
        const searchInput = document.getElementById("search-input") as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
    });

    // Open settings keyboard shortcuts page
    this.register({
      key: "?",
      description: "Show keyboard shortcuts",
      category: "Help",
      global: true,
      handler: async () => {
        const { openModal } = await import("./ui-helpers.ts");
        openModal("settings-modal");
        // Switch to shortcuts tab
        setTimeout(() => {
          const shortcutsTab = document.querySelector('[data-settings-tab="shortcuts"]') as HTMLElement;
          if (shortcutsTab) {
            shortcutsTab.click();
          }
        }, 100);
      },
    });

    // Note: Escape key is handled by handleKeyboard in keyboard/handler.ts
    // which has more sophisticated logic (bulk mode, omnibar, etc.)

    // Add bookmark
    this.register({
      key: "n",
      description: "Add new bookmark",
      category: "Actions",
      global: true,
      handler: () => {
        const addBtn = document.getElementById("sidebar-add-bookmark-btn");
        if (addBtn) addBtn.click();
      },
    });

    // Toggle sidebar
    this.register({
      key: "b",
      description: "Toggle sidebar",
      category: "Navigation",
      global: true,
      handler: () => {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
          sidebar.classList.toggle("hidden");
          state.setHideSidebar(!state.hideSidebar);
        }
      },
    });

    // View modes
    this.register({
      key: "1",
      description: "Grid view",
      category: "Views",
      global: true,
      handler: async () => {
        const { setViewMode } = await import("../App.ts");
        await setViewMode("grid");
      },
    });

    this.register({
      key: "2",
      description: "List view",
      category: "Views",
      global: true,
      handler: async () => {
        const { setViewMode } = await import("../App.ts");
        await setViewMode("list");
      },
    });

    this.register({
      key: "3",
      description: "Compact view",
      category: "Views",
      global: true,
      handler: async () => {
        const { setViewMode } = await import("../App.ts");
        await setViewMode("compact");
      },
    });

    // Navigation
    this.register({
      key: "g d",
      description: "Go to Dashboard",
      category: "Navigation",
      global: true,
      handler: async () => {
        await state.setCurrentView("dashboard");
        const { updateHeaderContent } = await import("../App.ts");
        await updateHeaderContent();
        const { renderDashboard } = await import("@features/bookmarks/dashboard.ts");
        renderDashboard();
      },
    });

    this.register({
      key: "g a",
      description: "Go to All Bookmarks",
      category: "Navigation",
      global: true,
      handler: async () => {
        await state.setCurrentView("all");
        state.setCurrentFolder(null);
        const { updateHeaderContent } = await import("../App.ts");
        await updateHeaderContent();
        const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
        await loadBookmarks();
      },
    });

    this.register({
      key: "g f",
      description: "Go to Favorites",
      category: "Navigation",
      global: true,
      handler: async () => {
        await state.setCurrentView("favorites");
        const { updateHeaderContent } = await import("../App.ts");
        await updateHeaderContent();
        const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
        await loadBookmarks();
      },
    });

    // Bulk selection
    this.register({
      key: "x",
      description: "Toggle bulk selection",
      category: "Actions",
      global: true,
      handler: async () => {
        state.setBulkMode(!state.bulkMode);
        const { updateBulkUI } = await import("./ui-helpers.ts");
        updateBulkUI();
      },
    });
  }

  /**
   * Clear sequence buffer and timeout
   */
  private clearSequence(): void {
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
      this.sequenceTimeout = null;
    }
    this.sequenceBuffer = [];
  }

  /**
   * Handle key press
   * Public method to be called from unified keyboard handler
   * Supports both single-key and multi-key sequences
   */
  handleKeyPress(e: KeyboardEvent): boolean {
    // Returns true if a shortcut was handled, false otherwise
    // Don't handle if typing in input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      // Allow Escape and Ctrl/Cmd shortcuts even in inputs
      if (e.key !== "Escape" && !e.ctrlKey && !e.metaKey) {
        // Clear any pending sequence when typing in inputs
        this.clearSequence();
        return false; // Not handled, let other handlers process it
      }
    }

    // Clear sequence on modifier keys (they break sequences)
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
      this.clearSequence();
    }

    const currentKey = e.key.toLowerCase();

    // Check for multi-key sequences first
    if (this.sequenceBuffer.length > 0) {
      // We're in the middle of a sequence
      this.sequenceBuffer.push(currentKey);
      const sequenceKey = this.sequenceBuffer.join(" ");

      // Check if this completes a registered sequence
      const sequenceShortcut = this.shortcuts.get(sequenceKey);
      if (sequenceShortcut) {
        this.clearSequence();
        if (sequenceShortcut.preventDefault !== false) {
          e.preventDefault();
        }

        try {
          const result = sequenceShortcut.handler();
          if (result instanceof Promise) {
            result.catch((err) => {
              console.error("Shortcut handler error:", err);
              showToast("Shortcut action failed", "error");
            });
          }
          return true; // Sequence was handled
        } catch (err) {
          console.error("Shortcut handler error:", err);
          showToast("Shortcut action failed", "error");
          return true; // Sequence was attempted
        }
      } else {
        // Check if this could be the start of a longer sequence
        // Look for shortcuts that start with the current sequence
        const possibleSequence = Array.from(this.shortcuts.keys()).find(
          (k) => k.startsWith(sequenceKey + " ")
        );
        if (possibleSequence) {
          // Reset timeout - sequence might continue
          if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
          }
          this.sequenceTimeout = setTimeout(() => {
            this.clearSequence();
          }, this.SEQUENCE_TIMEOUT_MS);
          // Don't prevent default yet, wait for more keys
          return false;
        } else {
          // No matching sequence, clear and try single key
          this.clearSequence();
        }
      }
    }

    // Check if this key starts a multi-key sequence
    const possibleSequences = Array.from(this.shortcuts.keys()).filter(
      (k) => k.startsWith(currentKey + " ")
    );
    if (possibleSequences.length > 0 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      // Start tracking sequence
      this.sequenceBuffer = [currentKey];
      this.sequenceTimeout = setTimeout(() => {
        this.clearSequence();
      }, this.SEQUENCE_TIMEOUT_MS);
      // Prevent default to avoid browser shortcuts (like "g" for Google search)
      e.preventDefault();
      // Return false so other handlers don't process it, but we're tracking the sequence
      return false;
    }

    // Build key string for single-key shortcuts
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    parts.push(currentKey);

    const key = parts.join(" ");

    // Check for exact match first
    let shortcut = this.shortcuts.get(key);
    
    // Only fall back to unmodified key if NO modifiers are pressed
    // If modifiers are pressed and no match found, don't fall back
    // (let legacy handler process it)
    if (!shortcut && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      // Try without modifiers for single keys (only when no modifiers pressed)
      shortcut = this.shortcuts.get(currentKey);
    }

    if (shortcut) {
      // Clear any pending sequence when a single-key shortcut matches
      this.clearSequence();
      if (shortcut.preventDefault !== false) {
        e.preventDefault();
      }

      try {
        const result = shortcut.handler();
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error("Shortcut handler error:", err);
            showToast("Shortcut action failed", "error");
          });
        }
        return true; // Shortcut was handled
      } catch (err) {
        console.error("Shortcut handler error:", err);
        showToast("Shortcut action failed", "error");
        return true; // Shortcut was attempted
      }
    }
    return false; // No shortcut matched
  }

}

// Create singleton instance
const keyboardShortcuts = new KeyboardShortcuts();

export { keyboardShortcuts, KeyboardShortcuts };
export type { Shortcut };
