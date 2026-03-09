import { useEffect } from "react";
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

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsInitialLoad(false);
      loadSettings();
      loadFolders();
      loadBookmarks();
    }
  }, [
    isAuthenticated,
    loadSettings,
    loadFolders,
    loadBookmarks,
    setIsInitialLoad,
  ]);

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
