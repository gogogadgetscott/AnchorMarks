/**
 * AnchorMarks - Commands Module
 * Handles omnibar/search functionality
 */

import * as state from "@features/state.ts";
import { openModal, updateActiveNav } from "@utils/ui-helpers.ts";
import type { Command } from "../../types/index";
import type { Bookmark } from "../../types/index";

export function bookmarkToCommand(b: Bookmark): Command {
  const isView =
    !!b.url &&
    (b.url.startsWith("view:") || b.url.startsWith("bookmark-view:"));
  const category = isView ? ("view" as const) : ("bookmark" as const);

  return {
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
        window.open(b.url, "_blank");
        import("@services/api.ts").then(({ api }) => {
          api(`/bookmarks/${b.id}/click`, { method: "POST" }).catch(() => {});
        });
      }
    },
    icon: "",
    category,
    description: b.url,
    url: b.url,
    favicon: b.favicon || "",
  };
}

// Cache for all bookmarks (unfiltered)
let allBookmarksCache: Bookmark[] = [];
let lastBookmarksFetch: number = 0;
const CACHE_DURATION = 30000; // 30 seconds

function canUseBackgroundApiRefresh(): boolean {
  if (typeof window === "undefined") return false;
  const origin = window.location?.origin || "";
  return origin.startsWith("http://") || origin.startsWith("https://");
}

// Refresh all bookmarks cache in background
export async function refreshOmnibarBookmarks(): Promise<void> {
  // Skip if the cache is still fresh to avoid hammering the API on every view switch
  if (Date.now() - lastBookmarksFetch < CACHE_DURATION) return;

  // In test/jsdom or non-http origins, relative API URLs are not fetchable.
  // Fall back to in-memory/state bookmarks without noisy warnings.
  if (!canUseBackgroundApiRefresh()) {
    lastBookmarksFetch = Date.now();
    return;
  }

  try {
    const { api } = await import("@services/api.ts");
    const response = await api<Bookmark[]>("/bookmarks?limit=1000");
    allBookmarksCache = Array.isArray(response) ? response : [];
    lastBookmarksFetch = Date.now();
  } catch (err) {
    const errText = String(err);
    const isRelativeUrlRuntimeWarning =
      errText.includes("Failed to parse URL") ||
      errText.includes("Invalid URL");

    if (!isRelativeUrlRuntimeWarning) {
      console.error("Failed to fetch bookmarks for omnibar:", err);
    }
  }
}

// Get all bookmarks (from cache, refresh if stale)
export function getAllBookmarks(): Bookmark[] {
  const now = Date.now();

  // Refresh in background if cache is stale
  if (now - lastBookmarksFetch > CACHE_DURATION) {
    refreshOmnibarBookmarks(); // Don't await, let it update in background
  }

  // Return cache (or state.bookmarks as fallback if cache empty)
  return allBookmarksCache.length > 0 ? allBookmarksCache : state.bookmarks;
}

// Get omnibar/search commands
export function getOmnibarCommands(filterText: string = ""): Command[] {
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
      action: async () => {
        await state.setCurrentView("dashboard");
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
      action: async () => {
        await state.setCurrentView("tag-cloud");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Tag Cloud";
        import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
          loadBookmarks(),
        );
      },
      icon: "☁️",
      category: "command",
      description: "View interactive tag cloud",
    },
    {
      label: "View favorites",
      action: async () => {
        await state.setCurrentView("favorites");
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
      action: async () => {
        await state.setCurrentView("all");
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
      label: "Switch to System theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("system", true),
        );
      },
      icon: "🖥️",
      category: "command",
      description: "Use system theme preference",
    },
    {
      label: "Switch to Light theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("light", true),
        );
      },
      icon: "☀️",
      category: "command",
      description: "Use light color theme",
    },
    {
      label: "Switch to Dark theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("dark", true),
        );
      },
      icon: "🌙",
      category: "command",
      description: "Use dark color theme",
    },
    {
      label: "Switch to Ocean theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("ocean", true),
        );
      },
      icon: "🌊",
      category: "command",
      description: "Use ocean color theme",
    },
    {
      label: "Switch to Sunset theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("sunset", true),
        );
      },
      icon: "🌅",
      category: "command",
      description: "Use sunset color theme",
    },
    {
      label: "Switch to Midnight theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("midnight", true),
        );
      },
      icon: "🌌",
      category: "command",
      description: "Use midnight color theme",
    },
    {
      label: "Switch to High Contrast theme",
      action: () => {
        import("@features/bookmarks/settings.ts").then(({ setTheme }) =>
          setTheme("high-contrast", true),
        );
      },
      icon: "◐",
      category: "command",
      description: "Use high contrast theme",
    },
    {
      label: "Import bookmarks",
      action: () => {
        openModal("settings-modal");
        // Switch to import tab after modal opens
        setTimeout(() => {
          const importTab = document.querySelector(
            '[data-settings-tab="import"]',
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
          Promise.all([import("@features/bookmarks/dashboard.ts")]).then(
            ([dashboardModule]) => {
              // Header is now React-based and updates via Context; legacy updateHeaderContent removed
              dashboardModule.renderDashboard();
              setTimeout(() => dashboardModule.toggleFullscreen(), 100);
            },
          );
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

  // Use getAllBookmarks() to search all bookmarks, not just filtered ones
  const allBookmarks = getAllBookmarks();

  // Filter based on search mode
  let results: Command[] = [];

  if (isCommandSearch) {
    results = baseCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );
  } else if (isFolderSearch) {
    results = folderCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );
  } else if (isTagSearch) {
    // Filter across all cached bookmarks (not a pre-sliced subset)
    results = allBookmarks
      .filter((b) => b.tags?.toLowerCase().includes(searchTerm))
      .slice(0, 15)
      .map(bookmarkToCommand);
  } else if (isBookmarkOnly && searchTerm.length >= 1) {
    // Search across all cached bookmarks by title/URL/description/tags so
    // matches are not limited to the first N items.
    const matchingBookmarks = allBookmarks
      .filter((b) => {
        const label = (b.title || "").toLowerCase();
        const url = (b.url || "").toLowerCase();
        const description = (b.description || "").toLowerCase();
        const tags = (b.tags || "").toLowerCase();
        return (
          label.includes(searchTerm) ||
          url.includes(searchTerm) ||
          description.includes(searchTerm) ||
          tags.includes(searchTerm)
        );
      })
      .slice(0, 15)
      .map(bookmarkToCommand);
    const matchingCommands = baseCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );
    const matchingFolders = folderCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(searchTerm),
    );

    // Collect unique tags that match the search term
    const matchingTagNames = new Set<string>();
    allBookmarks.forEach((b) => {
      if (b.tags) {
        b.tags.split(",").forEach((t) => {
          const tag = t.trim();
          if (tag && tag.toLowerCase().includes(searchTerm)) {
            matchingTagNames.add(tag);
          }
        });
      }
    });

    // Create "Filter by tag" commands for discovered tags
    const tagFilterCommands: Command[] = Array.from(matchingTagNames)
      .slice(0, 5)
      .map((tagName) => ({
        label: `Filter by tag: ${tagName}`,
        action: () => {
          import("@features/bookmarks/search.ts").then(({ sidebarFilterTag }) =>
            sidebarFilterTag(tagName),
          );
          import("@features/bookmarks/omnibar-controller.ts").then(
            ({ closeOmnibar }) => closeOmnibar(),
          );
        },
        icon: "#",
        category: "command" as const,
        description: `Show all bookmarks tagged "${tagName}"`,
      }));

    const applySearchCommand: Command = {
      label: `Apply "${searchTerm}" to filter`,
      action: () => {
        state.setFilterConfig({
          ...state.filterConfig,
          search: searchTerm,
        });
        const searchInput = document.getElementById(
          "search-input",
        ) as HTMLInputElement;
        if (searchInput) searchInput.value = "";

        // Switch to bookmarks view if not already there
        if (state.currentView !== "all" && state.currentView !== "folder") {
          state.setCurrentView("all");
          state.setCurrentFolder(null);
          const viewTitle = document.getElementById("view-title");
          if (viewTitle) viewTitle.textContent = "Bookmarks";
          updateActiveNav();
        }

        import("@features/bookmarks/bookmarks.ts").then(({ renderBookmarks }) =>
          renderBookmarks(),
        );
        import("@features/bookmarks/filters.ts").then(
          ({ updateFilterButtonText }) => updateFilterButtonText(),
        );
        import("@features/bookmarks/search.ts").then(
          ({ renderActiveFilters }) => renderActiveFilters(),
        );
        import("@features/bookmarks/omnibar-controller.ts").then(
          ({ closeOmnibar }) => closeOmnibar(),
        );
      },
      icon: "🔍",
      category: "command" as const,
      description: "Apply the current search term as a persistent filter",
    };

    // Show apply command first, then tag filters, then bookmarks, then folders, then commands
    const resultsArray = [
      ...tagFilterCommands,
      ...matchingBookmarks.slice(0, 10),
      ...matchingFolders,
      ...matchingCommands,
    ];

    // Only add apply command if there are results to apply to
    if (resultsArray.length > 0) {
      resultsArray.unshift(applySearchCommand);
    }

    results = resultsArray;
  } else {
    // No search term - show commands and folders first, then some recent bookmarks
    const recentBookmarks = allBookmarks.slice(0, 5).map(bookmarkToCommand);
    results = [...baseCommands, ...folderCommands, ...recentBookmarks];
  }

  return results;
}

export default {
  getOmnibarCommands,
  refreshOmnibarBookmarks,
};
