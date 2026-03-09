import { useEffect } from "react";
import { useBookmarks } from "../contexts/BookmarksContext";
import { useUI } from "../contexts/UIContext";
import { keyboardShortcuts } from "../utils/keyboard-shortcuts";
import { handleKeyboard } from "../features/keyboard/handler";

/**
 * Hook to inject React context actions into keyboard shortcuts system
 * and register the global keyboard event listener.
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

    // Register global keyboard event listener
    // Use capture phase to intercept browser shortcuts (like Ctrl+K) before browser handles them
    const keydownHandler = (e: KeyboardEvent) => {
      handleKeyboard(e);
    };

    document.addEventListener("keydown", keydownHandler, { capture: true });

    // Cleanup on unmount
    return () => {
      keyboardShortcuts.setContextActions({});
      document.removeEventListener("keydown", keydownHandler, {
        capture: true,
      });
    };
  }, [
    loadBookmarks,
    setCurrentView,
    setCurrentFolder,
    setBulkMode,
    setViewMode,
  ]);
}
