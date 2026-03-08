/**
 * Context Bridge
 *
 * Provides imperative access to React context for non-React code (api.ts, auth.ts, etc.)
 *
 * Uses a mutable store pattern: contexts sync their current state values into the store
 * via useEffect with proper dependencies. Non-React code reads from the store via
 * get*Bridge(), which always reflects the latest React state.
 */

import type { User, Bookmark, Folder } from "../types/index";

// ─── Auth State Bridge ────────────────────────────────────────────────────────

interface AuthStore {
  csrfToken: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
  setCsrfToken: (val: string | null) => void;
  setCurrentUser: (val: User | null) => void;
  setIsAuthenticated: (val: boolean) => void;
  logout: () => void;
}

const _auth: Partial<AuthStore> = {};

export function syncAuthBridge(store: AuthStore): void {
  Object.assign(_auth, store);
}

export function getAuthBridge() {
  if (!_auth.setCsrfToken) {
    throw new Error(
      "AuthBridge not initialized - ensure AuthProvider is mounted",
    );
  }
  const s = _auth as AuthStore;
  return {
    getCsrfToken: () => s.csrfToken,
    setCsrfToken: (val: string | null) => s.setCsrfToken(val),
    getCurrentUser: () => s.currentUser,
    setCurrentUser: (val: User | null) => s.setCurrentUser(val),
    getIsAuthenticated: () => s.isAuthenticated,
    setIsAuthenticated: (val: boolean) => s.setIsAuthenticated(val),
    logout: () => s.logout(),
  };
}

// ─── Bookmarks State Bridge ───────────────────────────────────────────────────

interface BookmarksStore {
  bookmarks: Bookmark[];
  renderedBookmarks: Bookmark[];
  totalCount: number;
  selectedBookmarks: Set<string>;
  bulkMode: boolean;
  setBookmarks: (val: Bookmark[]) => void;
  setRenderedBookmarks: (val: Bookmark[]) => void;
  setTotalCount: (val: number) => void;
  setSelectedBookmarks: (val: Set<string>) => void;
  setBulkMode: (val: boolean) => void;
  loadBookmarks: () => Promise<void>;
}

const _bookmarks: Partial<BookmarksStore> = {};

export function syncBookmarksBridge(store: BookmarksStore): void {
  Object.assign(_bookmarks, store);
}

export function getBookmarksBridge() {
  if (!_bookmarks.setBookmarks) {
    throw new Error(
      "BookmarksBridge not initialized - ensure BookmarksProvider is mounted",
    );
  }
  const s = _bookmarks as BookmarksStore;
  return {
    getBookmarks: () => s.bookmarks,
    setBookmarks: (val: Bookmark[]) => s.setBookmarks(val),
    getRenderedBookmarks: () => s.renderedBookmarks,
    setRenderedBookmarks: (val: Bookmark[]) => s.setRenderedBookmarks(val),
    getTotalCount: () => s.totalCount,
    setTotalCount: (val: number) => s.setTotalCount(val),
    getSelectedBookmarks: () => s.selectedBookmarks,
    setSelectedBookmarks: (val: Set<string>) => s.setSelectedBookmarks(val),
    getBulkMode: () => s.bulkMode,
    setBulkMode: (val: boolean) => s.setBulkMode(val),
    loadBookmarks: () => s.loadBookmarks(),
  };
}

// ─── UI State Bridge ──────────────────────────────────────────────────────────

interface UIStore {
  currentView: string;
  currentFolder: string | null;
  hideSidebar: boolean;
  setCurrentView: (val: string) => Promise<void>;
  setCurrentFolder: (val: string | null) => void;
  setHideSidebar: (val: boolean) => void;
}

const _ui: Partial<UIStore> = {};

export function syncUIBridge(store: UIStore): void {
  Object.assign(_ui, store);
}

export function getUIBridge() {
  if (!_ui.setCurrentView) {
    throw new Error("UIBridge not initialized - ensure UIProvider is mounted");
  }
  const s = _ui as UIStore;
  return {
    getCurrentView: () => s.currentView,
    setCurrentView: (val: string) => s.setCurrentView(val),
    getCurrentFolder: () => s.currentFolder,
    setCurrentFolder: (val: string | null) => s.setCurrentFolder(val),
    getHideSidebar: () => s.hideSidebar,
    setHideSidebar: (val: boolean) => s.setHideSidebar(val),
  };
}

// ─── Folders State Bridge ─────────────────────────────────────────────────────

interface FoldersStore {
  folders: Folder[];
  setFolders: (val: Folder[]) => void;
  loadFolders: () => Promise<void>;
}

const _folders: Partial<FoldersStore> = {};

export function syncFoldersBridge(store: FoldersStore): void {
  Object.assign(_folders, store);
}

export function getFoldersBridge() {
  if (!_folders.setFolders) {
    throw new Error(
      "FoldersBridge not initialized - ensure FoldersProvider is mounted",
    );
  }
  const s = _folders as FoldersStore;
  return {
    getFolders: () => s.folders,
    setFolders: (val: Folder[]) => s.setFolders(val),
    loadFolders: () => s.loadFolders(),
  };
}

// ─── API Configuration ────────────────────────────────────────────────────────

export const API_BASE = "/api";
