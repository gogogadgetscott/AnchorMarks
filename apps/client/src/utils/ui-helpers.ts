/**
 * AnchorMarks - UI Module
 * Handles modals, toasts, and general UI functions
 */

import {
  getUIBridge,
  getFoldersBridge,
  getBookmarksBridge,
} from "@contexts/context-bridge";
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
  const bookmarksBridge = getBookmarksBridge();
  for (const bookmark of bookmarksBridge.getRenderedBookmarks()) {
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
  // This function is no longer needed - React manages stats via Header component
  // Skip execution safely
  return;
}

/** @deprecated Use EmptyState React component */
export function getEmptyStateMessage(): string {
  // This function is no longer needed - React manages empty state via EmptyState component
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
