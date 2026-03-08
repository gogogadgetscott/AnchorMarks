/**
 * AnchorMarks - UI Module
 * Handles modals, toasts, and general UI functions
 */

import * as state from "@features/state.ts";
import { parseTagInput } from "@utils/index.ts";
import * as modalController from "@utils/modal-controller.ts";
import { showToast as showToastReact, ToastType } from "@contexts/ToastContext";

// DOM Element references (initialized on DOMContentLoaded)
// Only keeping ones that are still potentially used by legacy logic
export const dom: {
  searchInput: HTMLInputElement | null;
  bookmarkTagsInput: HTMLInputElement | null;
  tagSuggestions: HTMLElement | null;
} = {
  searchInput: null,
  bookmarkTagsInput: null,
  tagSuggestions: null,
};

// Initialize DOM references
export function initDom(): void {
  dom.searchInput = document.getElementById("search-input") as HTMLInputElement;
  dom.bookmarkTagsInput = document.getElementById(
    "bookmark-tags",
  ) as HTMLInputElement;
  dom.tagSuggestions = document.getElementById("tag-suggestions");
}

// Show toast notification
export function showToast(message: string, type: string = ""): void {
  showToastReact(message, type as ToastType);
}

// Open modal
export function openModal(id: string): void {
  modalController.openModal(id);
}

// Close all modals
export function closeModals(): void {
  modalController.closeModals();
  resetForms();
}

// Reset forms
export async function resetForms(): Promise<void> {
  const bookmarkForm = document.getElementById(
    "bookmark-form",
  ) as HTMLFormElement;
  const folderForm = document.getElementById("folder-form") as HTMLFormElement;

  if (bookmarkForm) bookmarkForm.reset();
  if (folderForm) folderForm.reset();

  if (dom.tagSuggestions) dom.tagSuggestions.innerHTML = "";

  // Clear the badge-based tag input
  try {
    const { clearTags } = await import("@features/bookmarks/tag-input.ts");
    clearTags();
  } catch {
    // Tag input module may not be available
  }
}

// Add tag to input field
export function addTagToInput(tag: string): void {
  if (!dom.bookmarkTagsInput) return;
  const current = new Set(parseTagInput(dom.bookmarkTagsInput.value));
  current.add(tag);
  dom.bookmarkTagsInput.value = Array.from(current).join(", ");
}

/** @deprecated Managed by React (Sidebar) */
export function updateActiveNav(): void {}

/** @deprecated Managed by React (Sidebar/Header) */
export function updateCounts(): void {}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getTagCountFromRenderedBookmarks(): number {
  const unique = new Set<string>();
  for (const bookmark of state.renderedBookmarks) {
    const raw = (bookmark as { tags?: unknown }).tags;
    if (!raw) continue;

    if (Array.isArray(raw)) {
      for (const tag of raw) {
        const t = String(tag).trim();
        if (t) unique.add(t.toLowerCase());
      }
      continue;
    }

    for (const tag of String(raw).split(",")) {
      const t = tag.trim();
      if (t) unique.add(t.toLowerCase());
    }
  }
  return unique.size;
}

/** @deprecated Managed by React (Sidebar/Header) */
export function updateStats(): void {
  const bookmarkCount = state.totalCount;
  const folderCount =
    state.currentView === "dashboard"
      ? state.dashboardWidgets.filter((w) => w.type === "folder").length
      : state.folders.length;
  const tagCount =
    state.currentView === "dashboard"
      ? state.dashboardWidgets.filter((w) => w.type === "tag").length
      : getTagCountFromRenderedBookmarks();

  setText("stat-bookmarks", String(bookmarkCount));
  setText("stat-folders", String(folderCount));
  setText("stat-tags", String(tagCount));
  setText("folders-count", String(folderCount));
  setText("stat-label-links", bookmarkCount === 1 ? "link" : "links");
  setText("stat-label-folders", folderCount === 1 ? "folder" : "folders");
  setText("stat-label-tags", tagCount === 1 ? "tag" : "tags");
}

/** @deprecated Use EmptyState React component */
export function getEmptyStateMessage(): string {
  const hasTagFilters = state.filterConfig.tags.length > 0;
  const search = dom.searchInput?.value?.trim() ?? "";

  if (hasTagFilters) {
    return "<h3>No bookmarks with these tags</h3>";
  }

  if (search) {
    return `<h3>No results found</h3><p>No bookmarks match \"${search}\".</p>`;
  }

  if (state.currentView === "favorites") {
    return "<h3>You haven't added any favorites yet</h3>";
  }

  if (state.currentView === "archived") {
    return "<h3>No archived bookmarks</h3>";
  }

  return "";
}

/** @deprecated Managed by React (Header) */
export function updateBulkUI(): void {}

export default {
  dom,
  initDom,
  showToast,
  openModal,
  closeModals,
  resetForms,
  addTagToInput,
  updateActiveNav,
  updateCounts,
  updateStats,
  getEmptyStateMessage,
  updateBulkUI,
};
