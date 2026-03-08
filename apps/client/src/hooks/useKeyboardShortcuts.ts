import { useEffect } from "react";
import { useBookmarks } from "../contexts/BookmarksContext";
import { useUI } from "../contexts/UIContext";
import { keyboardShortcuts } from "../utils/keyboard-shortcuts";

/**
 * Hook to inject React context actions into keyboard shortcuts system
 * This bridges the gap between non-React keyboard shortcuts and React state management
 */
export function useKeyboardShortcuts() {
  const { loadBookmarks, setBulkMode } = useBookmarks();
  const { setCurrentView, setCurrentFolder, setViewMode } = useUI();

  useEffect(() => {
    // Inject context actions into keyboard shortcuts singleton
    keyboardShortcuts.setContextActions({
      loadBookmarks,
      setCurrentView,
      setCurrentFolder,
      setBulkMode,
      setViewMode,
    });

    // Cleanup not strictly necessary since this is a singleton,
    // but good practice to clear on unmount
    return () => {
      keyboardShortcuts.setContextActions({});
    };
  }, [
    loadBookmarks,
    setCurrentView,
    setCurrentFolder,
    setBulkMode,
    setViewMode,
  ]);
}
