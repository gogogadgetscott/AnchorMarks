/**
 * AnchorMarks - Commands Module
 * Handles command palette functionality
 */

import * as state from "@features/state.ts";
import { openModal, updateActiveNav } from "@utils/ui-helpers.ts";
import type { Command } from "@/types";

// Get command palette commands
export function getCommandPaletteCommands(filterText: string = ""): Command[] {
  const term = filterText.toLowerCase().trim();

  // Check for special prefixes
  const isCommandSearch = term.startsWith(">");
  const isFolderSearch = term.startsWith("@");
  const isTagSearch = term.startsWith("#");
  const isBookmarkOnly =
    !isCommandSearch && !isFolderSearch && !isTagSearch && term.length > 0;

  // Clean the search term (remove prefix if present)
  const searchTerm = term.replace(/^[>#@]/, "").trim();

  const baseCommands: Command[] = [
    {
      label: "Add bookmark",
      action: () => openModal("bookmark-modal"),
      icon: "➕",
      category: "command",
      description: "Create a new bookmark",
    },
    {
      label: "Focus search",
      action: () =>
        (document.getElementById("search-input") as HTMLInputElement)?.focus(),
      icon: "🔍",
      category: "command",
      description: "Focus the search input",
    },
    {
      label: "Show dashboard",
      action: () => {
        state.setCurrentView("dashboard");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Dashboard";
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
      },
      icon: "📊",
      category: "command",
      description: "Go to dashboard view",
    },
    {
      label: "View tag cloud",
      action: () => {
        state.setCurrentView("tag-cloud");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Tag Cloud";
        import("@features/bookmarks/tag-cloud.ts").then(
          async ({ renderTagCloud }) => await renderTagCloud(),
        );
      },
      icon: "☁️",
      category: "command",
      description: "View interactive tag cloud",
    },
    {
      label: "View favorites",
      action: () => {
        state.setCurrentView("favorites");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Favorites";
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
      },
      icon: "⭐",
      category: "command",
      description: "View favorite bookmarks",
    },
    {
      label: "View all bookmarks",
      action: () => {
        state.setCurrentView("all");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Bookmarks";
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
      },
      icon: "📚",
      category: "command",
      description: "Show all bookmarks",
    },
    {
      label: "Open settings",
      action: () => openModal("settings-modal"),
      icon: "⚙️",
      category: "command",
      description: "Open application settings",
    },
    {
      label: "Import bookmarks",
      action: () => {
        openModal("settings-modal");
        // Switch to import tab after modal opens
        setTimeout(() => {
          const importTab = document.querySelector(
            '[data-settings-tab="import-export"]',
          ) as HTMLElement;
          importTab?.click();
        }, 100);
      },
      icon: "📥",
      category: "command",
      description: "Import bookmarks from file",
    },
    {
      label: "Export bookmarks",
      action: () => {
        import("@features/bookmarks/import-export.ts").then(({ exportJson }) =>
          exportJson(),
        );
      },
      icon: "📤",
      category: "command",
      description: "Export bookmarks to file",
    },
    {
      label: "Toggle fullscreen",
      action: () => {
        if (state.currentView === "dashboard") {
          import("@features/bookmarks/dashboard.ts").then(
            ({ toggleFullscreen }) => toggleFullscreen(),
          );
        } else {
          // Switch to dashboard first, then toggle fullscreen
          state.setCurrentView("dashboard");
          updateActiveNav();
          Promise.all([
            import("@/App.ts"),
            import("@features/bookmarks/dashboard.ts"),
          ]).then(([appModule, dashboardModule]) => {
            appModule.updateHeaderContent();
            dashboardModule.renderDashboard();
            setTimeout(() => dashboardModule.toggleFullscreen(), 100);
          });
        }
      },
      icon: "⛶",
      category: "command",
      description: "Toggle fullscreen mode (dashboard)",
    },
    {
      label: "Open maintenance settings",
      action: () => {
        openModal("settings-modal");
        // Switch to maintenance tab after modal opens
        setTimeout(() => {
          const maintenanceTab = document.querySelector(
            '[data-settings-tab="maintenance"]',
          ) as HTMLElement;
          maintenanceTab?.click();
        }, 100);
      },
      icon: "🔧",
      category: "command",
      description: "Check links, find duplicates, refresh favicons",
    },
  ];

  const folderCommands: Command[] = state.folders
    .filter((f) => !f.parent_id)
    .map((f) => ({
      label: f.name,
      action: () => {
        state.setCurrentView("folder");
        state.setCurrentFolder(f.id);
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = f.name;
        updateActiveNav();
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
      },
      icon: "📁",
      category: "folder" as const,
      description: `Go to folder`,
    }));

  // Create bookmark commands (for launcher functionality)
  const bookmarkCommands: Command[] = state.bookmarks
    .slice(0, 100) // Limit to first 100 for performance
    .map((b) => ({
      label: b.title || b.url,
      action: () => {
        if (b.url.startsWith("view:")) {
          const viewId = b.url.substring(5);
          import("@features/bookmarks/dashboard.ts").then(({ restoreView }) =>
            restoreView(viewId, b.title),
          );
        } else if (b.url.startsWith("bookmark-view:")) {
          const viewId = b.url.substring(14);
          import("@features/bookmarks/bookmarks.ts").then(
            ({ restoreBookmarkView }) => restoreBookmarkView(viewId),
          );
        } else {
          // Open the bookmark URL
          window.open(b.url, "_blank");
          // Increment click count
          import("@services/api.ts").then(({ api }) => {
            api(`/bookmarks/${b.id}/click`, { method: "POST" }).catch(() => {});
          });
        }
      },
      icon: "",
      category: "bookmark" as const,
      description: b.url,
      url: b.url,
      favicon: b.favicon || "",
    }));

  // Filter based on search mode
  let results: Command[] = [];

  if (isCommandSearch) {
    // Only show commands when using > prefix
    results = baseCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );
  } else if (isFolderSearch) {
    // Only show folders when using @ prefix
    results = folderCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );
  } else if (isTagSearch) {
    // Filter by tag - show bookmarks with matching tags
    results = bookmarkCommands.filter((cmd) => {
      const bookmark = state.bookmarks.find((b) => b.url === cmd.url);
      return bookmark?.tags?.toLowerCase().includes(searchTerm);
    });
  } else if (isBookmarkOnly && searchTerm.length >= 1) {
    // When searching, prioritize bookmarks but show everything that matches
    const matchingBookmarks = bookmarkCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(searchTerm) ||
        cmd.description?.toLowerCase().includes(searchTerm),
    );
    const matchingCommands = baseCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );
    const matchingFolders = folderCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );

    // Show bookmarks first (main launcher use case), then folders, then commands
    results = [
      ...matchingBookmarks.slice(0, 10),
      ...matchingFolders,
      ...matchingCommands,
    ];
  } else {
    // No search term - show commands and folders first, then some recent bookmarks
    const recentBookmarks = bookmarkCommands.slice(0, 5);
    results = [...baseCommands, ...folderCommands, ...recentBookmarks];
  }

  return results;
}

// Shortcuts help popup
export function openShortcutsPopup(): void {
  const popup = document.getElementById("shortcuts-popup");
  if (!popup) return;
  popup.classList.remove("hidden");
}

export function closeShortcutsPopup(): void {
  const popup = document.getElementById("shortcuts-popup");
  if (!popup) return;
  popup.classList.add("hidden");
}

export default {
  getCommandPaletteCommands,
  openShortcutsPopup,
  closeShortcutsPopup,
};
