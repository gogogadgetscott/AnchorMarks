/**
 * Window API initialization - Exposes AnchorMarks functionality on window object
 * Provides backward compatibility with components that expect window.AnchorMarks
 */

import type { Bookmark, Tag } from "../types";

/**
 * Initialize the global AnchorMarks API on the window object
 * Call this once when the app initializes
 */
export function initializeWindowAPI(): void {
  const api: any = window.AnchorMarks || {};

  // These will be properly set by components that manage state
  // For now, provide no-op defaults
  api.showBookmarkModal = api.showBookmarkModal || (() => {});
  api.showTagModal = api.showTagModal || (() => {});
  api.deleteTag = api.deleteTag || (() => {});
  api.filterByTag = api.filterByTag || (() => {});
  api.setModalState = api.setModalState || (() => {});

  window.AnchorMarks = api;
}

/**
 * Register bookmark modal handler
 */
export function registerShowBookmarkModal(
  handler: (bookmark?: Bookmark | null) => void,
): void {
  const api: any = window.AnchorMarks || {};
  api.showBookmarkModal = handler;
  window.AnchorMarks = api;
}

/**
 * Register tag modal handler
 */
export function registerShowTagModal(handler: (tag?: Tag) => void): void {
  const api: any = window.AnchorMarks || {};
  api.showTagModal = handler;
  window.AnchorMarks = api;
}

/**
 * Register delete tag handler
 */
export function registerDeleteTag(handler: (tagId: string) => void): void {
  const api: any = window.AnchorMarks || {};
  api.deleteTag = handler;
  window.AnchorMarks = api;
}

/**
 * Register filter by tag handler
 */
export function registerFilterByTag(handler: (tagName: string) => void): void {
  const api: any = window.AnchorMarks || {};
  api.filterByTag = handler;
  window.AnchorMarks = api;
}

/**
 * Register modal state setter
 */
export function registerSetModalState(handler: (isOpen: boolean) => void): void {
  const api: any = window.AnchorMarks || {};
  api.setModalState = handler;
  window.AnchorMarks = api;
}
