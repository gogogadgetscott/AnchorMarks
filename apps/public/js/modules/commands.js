// Outside-click-to-close for command palette
// Assumes markup includes elements with classes: .command-palette and .command-palette-backdrop
// Provides a fallback close behavior if module close function isn't available
(function initCommandPaletteInteractions() {
  const panel = document.querySelector(".command-palette");
  const backdrop = document.querySelector(".command-palette-backdrop");
  if (!backdrop) return; // nothing to wire

  function hidePalette() {
    try {
      if (typeof window.closeCommandPalette === "function") {
        window.closeCommandPalette();
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
  let syncInterval = null;
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
      if (panel && panel.contains(e.target)) return;
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

import * as state from "./state.js";
import { escapeHtml } from "./utils.js";
import { openModal, updateActiveNav } from "./ui.js";
import { loadBookmarks } from "./bookmarks.js";

// Get command palette commands
export function getCommandPaletteCommands() {
  const baseCommands = [
    { label: "Add bookmark", action: () => openModal("bookmark-modal") },
    {
      label: "Focus search",
      action: () => document.getElementById("search-input")?.focus(),
    },
    {
      label: "Show dashboard",
      action: () => {
        state.setCurrentView("dashboard");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Dashboard";
        loadBookmarks();
      },
    },
    {
      label: "View favorites",
      action: () => {
        state.setCurrentView("favorites");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Favorites";
        loadBookmarks();
      },
    },
    {
      label: "View all",
      action: () => {
        state.setCurrentView("all");
        state.setCurrentFolder(null);
        updateActiveNav();
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Bookmarks";
        loadBookmarks();
      },
    },
    { label: "Open settings", action: () => openModal("settings-modal") },
  ];

  const folderCommands = state.folders
    .filter((f) => !f.parent_id)
    .map((f) => ({
      label: `Go to ${f.name}`,
      action: () => {
        state.setCurrentView("folder");
        state.setCurrentFolder(f.id);
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = f.name;
        updateActiveNav();
        loadBookmarks();
      },
    }));

  return [...baseCommands, ...folderCommands];
}

// Open command palette
export function openCommandPalette() {
  const palette = document.getElementById("command-palette");
  const input = document.getElementById("command-palette-input");

  if (!palette) return;

  state.setCommandPaletteOpen(true);
  palette.classList.remove("hidden");
  if (input) input.value = "";
  state.setCommandPaletteActiveIndex(0);
  renderCommandPaletteList("");
  input?.focus();
}

// Close command palette
export function closeCommandPalette() {
  const palette = document.getElementById("command-palette");
  const input = document.getElementById("command-palette-input");
  if (!palette) return;

  state.setCommandPaletteOpen(false);
  palette.classList.add("hidden");
  // Ensure focus returns to the app so global shortcuts work
  try {
    input?.blur();
  } catch (_) {}
}

// Render command palette list
export function renderCommandPaletteList(filterText) {
  const list = document.getElementById("command-palette-list");
  if (!list) return;

  const term = (filterText || "").toLowerCase();
  const entries = getCommandPaletteCommands().filter((cmd) =>
    cmd.label.toLowerCase().includes(term),
  );
  state.setCommandPaletteEntries(entries);
  state.setCommandPaletteActiveIndex(0);

  if (entries.length === 0) {
    list.innerHTML = '<div class="command-item">No matches</div>';
    return;
  }

  list.innerHTML = entries
    .map(
      (cmd, idx) => `
        <div class="command-item ${idx === state.commandPaletteActiveIndex ? "active" : ""}" data-index="${idx}">
            <span>${escapeHtml(cmd.label)}</span>
        </div>
    `,
    )
    .join("");
}

// Update command palette active item
export function updateCommandPaletteActive(direction) {
  const list = document.getElementById("command-palette-list");
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
export function runActiveCommand() {
  const cmd = state.commandPaletteEntries[state.commandPaletteActiveIndex];
  if (!cmd) return;

  closeCommandPalette();
  cmd.action();
}

// Shortcuts help popup
export function openShortcutsPopup() {
  const popup = document.getElementById("shortcuts-popup");
  if (!popup) return;
  popup.classList.remove("hidden");
}

export function closeShortcutsPopup() {
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
