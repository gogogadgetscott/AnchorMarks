import { useEffect, useRef } from "react";
import { useAuth } from "./contexts/AuthContext";
import { useBookmarks } from "./contexts/BookmarksContext";
import { useFolders } from "./contexts/FoldersContext";
import { useUI } from "./contexts/UIContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSettings } from "./hooks/useSettings";
import { AppShell } from "./AppShell";

export function App() {
  const { isAuthenticated, checkAuth } = useAuth();
  const { loadBookmarks } = useBookmarks();
  const { loadFolders } = useFolders();
  const { setIsInitialLoad, currentView } = useUI();
  const { loadSettings } = useSettings();

  // Inject React context actions into keyboard shortcuts system
  useKeyboardShortcuts();

  // Keep a stable ref to loadBookmarks so the init effect doesn't re-fire
  // every time filterConfig changes (which recreates the loadBookmarks callback).
  const loadBookmarksRef = useRef(loadBookmarks);
  useEffect(() => {
    loadBookmarksRef.current = loadBookmarks;
  }, [loadBookmarks]);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsInitialLoad(false);
      loadSettings();
      loadFolders();
      loadBookmarksRef.current();
    }
  }, [isAuthenticated, loadSettings, loadFolders, setIsInitialLoad]);

  // Reload bookmarks when view changes (except dashboard, analytics, and folder)
  // Note: folder view is handled by Sidebar folder click which calls loadBookmarks with folderId
  useEffect(() => {
    if (
      isAuthenticated &&
      currentView !== "dashboard" &&
      currentView !== "analytics" &&
      currentView !== "tag-cloud" &&
      currentView !== "folder"
    ) {
      loadBookmarks();
    }
  }, [currentView, isAuthenticated, loadBookmarks]);

  return <AppShell />;
}
