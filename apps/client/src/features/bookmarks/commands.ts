// Outside-click-to-close for command palette
// Assumes markup includes elements with classes: .command-palette and .command-palette-backdrop
// Provides a fallback close behavior if module close function isn't available
(function initCommandPaletteInteractions() {
  const panel = document.querySelector(".command-palette") as HTMLElement;
  const backdrop = document.querySelector(
    ".command-palette-backdrop",
  ) as HTMLElement;
  if (!backdrop) return; // nothing to wire

  function hidePalette() {
    try {
      if (typeof (window as any).closeCommandPalette === "function") {
        (window as any).closeCommandPalette();
        return;
      }
    } catch (_) {}
    if (panel) panel.style.display = "none";
    backdrop.style.display = "none";
  }

  // Sync backdrop position/size to exactly match the panel
  function syncBackdropToPanel() {
    if (!panel || !backdrop) return;
    const rect = panel.getBoundingClientRect();
    // Position backdrop to overlay the panel area
    backdrop.style.top = `${rect.top}px`;
    backdrop.style.left = `${rect.left}px`;
    backdrop.style.width = `${rect.width}px`;
    backdrop.style.height = `${rect.height}px`;
    // Match panel border radius visually
    const radius = window.getComputedStyle(panel).borderRadius;
    backdrop.style.borderRadius = radius || "8px";
  }

  // Observe size/visibility changes
  let syncInterval: number | null = null;
  function startSync() {
    if (syncInterval) return;
    syncBackdropToPanel();
    syncInterval = window.setInterval(syncBackdropToPanel, 100);
  }
  function stopSync() {
    if (!syncInterval) return;
    window.clearInterval(syncInterval);
    syncInterval = null;
  }

  // Start syncing when panel is shown; stop when hidden
  const observer = new MutationObserver(() => {
    const isVisible =
      panel && panel.offsetParent !== null && panel.style.display !== "none";
    if (isVisible) {
      startSync();
    } else {
      stopSync();
    }
  });
  if (panel) {
    observer.observe(panel, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    // Initial sync if already visible
    const initiallyVisible =
      panel.offsetParent !== null && panel.style.display !== "none";
    if (initiallyVisible) startSync();
  }

  window.addEventListener("resize", syncBackdropToPanel, { passive: true });

  // Only backdrop clicks close; clicks inside panel should not
  backdrop.addEventListener(
    "click",
    function onBackdropClick(e) {
      // If click originated inside panel, ignore
      if (panel && panel.contains(e.target as Node)) return;
      hidePalette();
    },
    { passive: true },
  );

  // ESC-to-close
  window.addEventListener(
    "keydown",
    function onKeydown(e) {
      if (e.key === "Escape") {
        hidePalette();
      }
    },
    { passive: true },
  );
})();
/**
 * AnchorMarks - Commands Module
 * Handles command palette functionality
 */

import * as state from "@features/state.ts";
import { escapeHtml } from "@utils/index.ts";
import { openModal, updateActiveNav } from "@utils/ui-helpers.ts";
// Bookmarks will be loaded dynamically
import { Command } from "@/types";

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
        // Open the bookmark URL
        window.open(b.url, "_blank");
        // Increment click count
        import("@services/api.ts").then(({ api }) => {
          api(`/bookmarks/${b.id}/click`, { method: "POST" }).catch(() => {});
        });
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

// Open command palette
export function openCommandPalette(): void {
  const palette = document.getElementById("quick-launch");
  const input = document.getElementById(
    "quick-launch-input",
  ) as HTMLInputElement;

  if (!palette) return;

  state.setCommandPaletteOpen(true);
  palette.classList.remove("hidden");
  if (input) input.value = "";
  state.setCommandPaletteActiveIndex(0);
  renderCommandPaletteList("");
  input?.focus();
}

// Close command palette
export function closeCommandPalette(): void {
  const palette = document.getElementById("quick-launch");
  const input = document.getElementById(
    "quick-launch-input",
  ) as HTMLInputElement;
  if (!palette) return;

  state.setCommandPaletteOpen(false);
  palette.classList.add("hidden");
  // Ensure focus returns to the app so global shortcuts work
  try {
    input?.blur();
  } catch (_) {}
}

// Render command palette list
export function renderCommandPaletteList(filterText: string): void {
  const list = document.getElementById("quick-launch-list");
  if (!list) return;

  // Get filtered commands (filtering is now done inside getCommandPaletteCommands)
  const entries: Command[] = getCommandPaletteCommands(filterText);
  state.setCommandPaletteEntries(entries);
  state.setCommandPaletteActiveIndex(0);

  if (entries.length === 0) {
    const term = (filterText || "").trim();
    const hint = term.startsWith(">")
      ? "No matching commands"
      : term.startsWith("@")
        ? "No matching folders"
        : term.startsWith("#")
          ? "No bookmarks with matching tags"
          : "No matches found";
    list.innerHTML = `<div class="command-item empty">${hint}</div>`;
    return;
  }

  list.innerHTML = entries
    .map((cmd, idx) => {
      // Determine icon - use favicon for bookmarks, emoji for others
      let iconHtml = "";
      if (cmd.category === "bookmark" && cmd.favicon) {
        iconHtml = `<img class="command-favicon" src="${escapeHtml(cmd.favicon)}" alt="" onerror="this.style.display='none'" />`;
      } else if (cmd.icon) {
        iconHtml = `<span class="command-icon">${cmd.icon}</span>`;
      } else if (cmd.category === "bookmark") {
        iconHtml = `<span class="command-icon">🔗</span>`;
      }

      // Truncate URL for display
      let descriptionHtml = "";
      // Don't show description (URL) for bookmarks to allow longer titles
      if (cmd.description && cmd.category !== "bookmark") {
        const shortDesc =
          cmd.description.length > 50
            ? cmd.description.substring(0, 50) + "..."
            : cmd.description;
        descriptionHtml = `<span class="command-desc">${escapeHtml(shortDesc)}</span>`;
      }

      // Category badge
      const categoryBadge =
        cmd.category && cmd.category !== "command"
          ? `<span class="command-category ${cmd.category}">${cmd.category}</span>`
          : "";

      return `
        <div class="command-item ${idx === state.commandPaletteActiveIndex ? "active" : ""} ${cmd.category || ""}" data-index="${idx}">
          <div class="command-item-left">
            ${iconHtml}
            <span class="command-label">${escapeHtml(cmd.label)}</span>
          </div>
          <div class="command-item-right">
            ${descriptionHtml}
            ${categoryBadge}
          </div>
        </div>
      `;
    })
    .join("");
}

// Update command palette active item
export function updateCommandPaletteActive(direction: number): void {
  const list = document.getElementById("quick-launch-list");
  if (!list || state.commandPaletteEntries.length === 0) return;

  const newIndex = Math.max(
    0,
    Math.min(
      state.commandPaletteEntries.length - 1,
      state.commandPaletteActiveIndex + direction,
    ),
  );
  state.setCommandPaletteActiveIndex(newIndex);

  list.querySelectorAll(".command-item").forEach((item, idx) => {
    item.classList.toggle("active", idx === newIndex);
  });

  const active = list.querySelector(".command-item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

// Run active command
export function runActiveCommand(): void {
  const cmd = state.commandPaletteEntries[state.commandPaletteActiveIndex] as
    | Command
    | undefined;
  if (!cmd) return;

  closeCommandPalette();
  cmd.action();
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
  openCommandPalette,
  closeCommandPalette,
  renderCommandPaletteList,
  updateCommandPaletteActive,
  runActiveCommand,
  openShortcutsPopup,
  closeShortcutsPopup,
};
