import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { useBookmarks } from "./contexts/BookmarksContext";
import { useFolders } from "./contexts/FoldersContext";
import { useUI } from "./contexts/UIContext";
import { AppShell } from "./AppShell";

export function App() {
  const { isAuthenticated } = useAuth();
  const { loadBookmarks } = useBookmarks();
  const { loadFolders } = useFolders();
  const { setIsInitialLoad } = useUI();

  useEffect(() => {
    if (isAuthenticated) {
      setIsInitialLoad(false);
      loadFolders();
      loadBookmarks();
    }
  }, [isAuthenticated, loadFolders, loadBookmarks, setIsInitialLoad]);

  return <AppShell />;
}
