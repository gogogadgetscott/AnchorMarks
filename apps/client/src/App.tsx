import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { useBookmarks } from "./contexts/BookmarksContext";
import { useFolders } from "./contexts/FoldersContext";
import { useUI } from "./contexts/UIContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { AppShell } from "./AppShell";

export function App() {
  const { isAuthenticated, checkAuth } = useAuth();
  const { loadBookmarks } = useBookmarks();
  const { loadFolders } = useFolders();
  const { setIsInitialLoad, currentView } = useUI();

  // Inject React context actions into keyboard shortcuts system
  useKeyboardShortcuts();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      setIsInitialLoad(false);
      loadFolders();
      loadBookmarks();
    }
  }, [isAuthenticated, loadFolders, loadBookmarks, setIsInitialLoad]);

  // Reload bookmarks when view changes (except dashboard and analytics)
  useEffect(() => {
    if (
      isAuthenticated &&
      currentView !== "dashboard" &&
      currentView !== "analytics" &&
      currentView !== "tag-cloud"
    ) {
      loadBookmarks();
    }
  }, [currentView, isAuthenticated, loadBookmarks]);

  return <AppShell />;
}
