/**
 * AnchorMarks - UI Module
 * Handles modals, toasts, and general UI functions
 */

import {
  getFoldersBridge,
  getBookmarksBridge,
} from "../contexts/context-bridge";
import { parseTagInput } from "./index";
import * as modalController from "./modal-controller";
import {
  showToast as showToastReact,
  ToastType,
} from "../contexts/ToastContext";
import * as state from "@features/state.ts";

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
  // Try to read rendered bookmarks from the Bookmarks bridge first. If the
  // bridge isn't initialized (tests that don't mount providers), fall back to
  // the vanilla state module which tests manipulate directly.
  let rendered: any[] = [];
  try {
    const bookmarksBridge = getBookmarksBridge();
    rendered = bookmarksBridge.getRenderedBookmarks() || [];
  } catch {
    rendered = (state && state.renderedBookmarks) || [];
  }

  for (const bookmark of rendered) {
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
  // Update legacy DOM counters for tests and for non-React legacy code that
  // still relies on these IDs. Prefer the bridge when available and fall back
  // to the vanilla state module for tests that manipulate state directly.
  let total = 0;
  let foldersCount = 0;
  try {
    const bookmarksBridge = getBookmarksBridge();
    total = bookmarksBridge.getTotalCount() ?? 0;
  } catch {
    total = state?.totalCount ?? 0;
  }

  try {
    // Prefer folders bridge if available
    const foldersBridge = getFoldersBridge();
    const f = foldersBridge.getFolders();
    foldersCount = Array.isArray(f) ? f.length : 0;
  } catch {
    foldersCount = Array.isArray(state?.folders) ? state.folders.length : 0;
  }

  const tagsCount = getTagCountFromRenderedBookmarks();

  setText("stat-bookmarks", String(total));
  setText("stat-folders", String(foldersCount));
  setText("stat-tags", String(tagsCount));
  // Legacy labels expected by tests
  setText("stat-label-links", "links");
  setText("folders-count", String(foldersCount));
}

/** @deprecated Use EmptyState React component */
export function getEmptyStateMessage(): string {
  // Provide a test-friendly empty state message for legacy tests that still
  // assert on HTML returned by this helper. Prefer reading from the bridge
  // when possible, otherwise read the vanilla state module.
  const filterTags: string[] = state?.filterConfig?.tags ?? [];
  const currentView: string = state?.currentView ?? "all";

  if (Array.isArray(filterTags) && filterTags.length > 0) {
    return `No bookmarks with these tags`;
  }

  if (dom.searchInput && dom.searchInput.value.trim().length > 0) {
    return `No results found`;
  }

  if (currentView === "favorites") {
    return `You haven't added any favorites yet`;
  }

  return `No bookmarks yet`;
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
