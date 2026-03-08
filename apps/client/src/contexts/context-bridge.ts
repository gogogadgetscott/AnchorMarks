/**
 * Context Bridge
 *
 * Provides imperative access to React context for non-React code (api.ts, auth.ts, etc.)
 * Each context registers its state getters/setters when it mounts.
 */

import type { User, Bookmark, Folder } from "../types/index";

// ─── Auth State Bridge ────────────────────────────────────────────────────────

interface AuthBridge {
  getCsrfToken: () => string | null;
  setCsrfToken: (val: string | null) => void;
  getCurrentUser: () => User | null;
  setCurrentUser: (val: User | null) => void;
  getIsAuthenticated: () => boolean;
  setIsAuthenticated: (val: boolean) => void;
}

let authBridge: AuthBridge | null = null;

export function registerAuthBridge(bridge: AuthBridge) {
  authBridge = bridge;
}

export function getAuthBridge(): AuthBridge {
  if (!authBridge) {
    throw new Error(
      "AuthBridge not initialized - ensure AuthProvider is mounted",
    );
  }
  return authBridge;
}

// ─── Bookmarks State Bridge ───────────────────────────────────────────────────

interface BookmarksBridge {
  getBookmarks: () => Bookmark[];
  setBookmarks: (val: Bookmark[]) => void;
  getRenderedBookmarks: () => Bookmark[];
  setRenderedBookmarks: (val: Bookmark[]) => void;
  getTotalCount: () => number;
  setTotalCount: (val: number) => void;
  getSelectedBookmarks: () => Set<string>;
  setSelectedBookmarks: (val: Set<string>) => void;
  getBulkMode: () => boolean;
  setBulkMode: (val: boolean) => void;
}

let bookmarksBridge: BookmarksBridge | null = null;

export function registerBookmarksBridge(bridge: BookmarksBridge) {
  bookmarksBridge = bridge;
}

export function getBookmarksBridge(): BookmarksBridge {
  if (!bookmarksBridge) {
    throw new Error(
      "BookmarksBridge not initialized - ensure BookmarksProvider is mounted",
    );
  }
  return bookmarksBridge;
}

// ─── UI State Bridge ──────────────────────────────────────────────────────────

interface UIBridge {
  getCurrentView: () => string;
  setCurrentView: (val: string) => Promise<void>;
  getCurrentFolder: () => string | null;
  setCurrentFolder: (val: string | null) => void;
  getHideSidebar: () => boolean;
  setHideSidebar: (val: boolean) => void;
}

let uiBridge: UIBridge | null = null;

export function registerUIBridge(bridge: UIBridge) {
  uiBridge = bridge;
}

export function getUIBridge(): UIBridge {
  if (!uiBridge) {
    throw new Error("UIBridge not initialized - ensure UIProvider is mounted");
  }
  return uiBridge;
}

// ─── Folders State Bridge ─────────────────────────────────────────────────────

interface FoldersBridge {
  getFolders: () => Folder[];
  setFolders: (val: Folder[]) => void;
}

let foldersBridge: FoldersBridge | null = null;

export function registerFoldersBridge(bridge: FoldersBridge) {
  foldersBridge = bridge;
}

export function getFoldersBridge(): FoldersBridge {
  if (!foldersBridge) {
    throw new Error(
      "FoldersBridge not initialized - ensure FoldersProvider is mounted",
    );
  }
  return foldersBridge;
}

// ─── API Configuration ────────────────────────────────────────────────────────

export const API_BASE = "/api";
