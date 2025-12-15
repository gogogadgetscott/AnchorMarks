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
  if (!palette) return;

  state.setCommandPaletteOpen(false);
  palette.classList.add("hidden");
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
