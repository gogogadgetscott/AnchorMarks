import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "../services/api.ts";
import * as state from "../features/state.ts";
import { syncFoldersBridge } from "./context-bridge";
import type { Folder, Tag } from "../types/index";
import { showToast } from "./ToastContext";
import { showConfirm } from "./ConfirmContext";
import { logger } from "@utils/logger";

interface FoldersState {
  folders: Folder[];
  currentFolder: string | null;
  currentCollection: string | null;
  draggedSidebarItem: Folder | Tag | null;
  isLoading: boolean;
}

interface FoldersMethods {
  createFolder: (
    data: Partial<Folder>,
    options?: { closeModal?: boolean },
  ) => Promise<Folder | null>;
  updateFolder: (id: string, data: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  getRecursiveBookmarkCount: (folderId: string) => number;
}

interface FoldersActions {
  loadFolders: () => Promise<void>;
  setFolders: (val: Folder[]) => void;
  setCurrentFolder: (val: string | null) => void;
  setCurrentCollection: (val: string | null) => void;
  setDraggedSidebarItem: (val: Folder | Tag | null) => void;
}

type FoldersContextValue = FoldersState & FoldersActions & FoldersMethods;

const FoldersContext = createContext<FoldersContextValue | null>(null);

export function FoldersProvider({ children }: { children: ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [currentCollection, setCurrentCollection] = useState<string | null>(
    null,
  );
  const [draggedSidebarItem, setDraggedSidebarItem] = useState<
    Folder | Tag | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync current state into the bridge store so non-React code always reads fresh values
  useEffect(() => {
    syncFoldersBridge({
      folders,
      setFolders: (val) => {
        setFolders(val);
        state.setFolders(val);
      },
      loadFolders,
    });
  }, [folders]);

  const loadFolders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<{ folders: Folder[] }>("/folders");
      const foldersData = data.folders || [];
      setFolders(foldersData);
      // Sync with vanilla state for backward compatibility
      state.setFolders(foldersData);
    } catch (err) {
      logger.error("Failed to load folders:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Count bookmarks in folder and all its subfolders (recursive)
  const getRecursiveBookmarkCount = useCallback(
    (folderId: string): number => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return 0;

      let total = folder.bookmark_count || 0;
      const children = folders.filter((f) => f.parent_id === folderId);
      children.forEach((child) => {
        total += getRecursiveBookmarkCount(child.id);
      });
      return total;
    },
    [folders],
  );

  // Create folder
  const createFolder = useCallback(
    async (
      data: Partial<Folder>,
      options: { closeModal?: boolean } = {},
    ): Promise<Folder | null> => {
      const { closeModal = true } = options;

      try {
        const folder = await api("/folders", {
          method: "POST",
          body: JSON.stringify(data),
        });
        const newFolder = folder as Folder;
        const updatedFolders = [...folders, newFolder];
        setFolders(updatedFolders);
        state.setFolders(updatedFolders);
        showToast("Folder created!", "success");
        return newFolder;
      } catch (err: unknown) {
        logger.error("Failed to create folder:", err);
        showToast((err as Error).message, "error");
        return null;
      }
    },
    [folders],
  );

  // Update folder
  const updateFolder = useCallback(
    async (id: string, data: Partial<Folder>): Promise<void> => {
      try {
        const folder = await api(`/folders/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        const updatedFolders = folders.map((f) =>
          f.id === id ? (folder as Folder) : f,
        );
        setFolders(updatedFolders);
        state.setFolders(updatedFolders);
        showToast("Folder updated!", "success");
      } catch (err: unknown) {
        logger.error("Failed to update folder:", err);
        showToast((err as Error).message, "error");
      }
    },
    [folders],
  );

  // Delete folder
  const deleteFolder = useCallback(
    async (id: string): Promise<void> => {
      const confirmed = await showConfirm(
        "Delete this folder? Bookmarks will be moved to uncategorized.",
        {
          title: "Delete Folder",
          destructive: true,
        },
      );

      if (!confirmed) return;

      try {
        await api(`/folders/${id}`, { method: "DELETE" });
        const updatedFolders = folders.filter((f) => f.id !== id);
        setFolders(updatedFolders);
        state.setFolders(updatedFolders);

        if (currentFolder === id) {
          setCurrentFolder(null);
          state.setCurrentFolder(null);
        }

        showToast("Folder deleted", "success");

        // Reload bookmarks if we're currently viewing this folder
        if (currentFolder === id) {
          const { loadBookmarks } =
            await import("@features/bookmarks/bookmarks.ts");
          loadBookmarks();
        }
      } catch (err: unknown) {
        logger.error("Failed to delete folder:", err);
        showToast((err as Error).message, "error");
      }
    },
    [folders, currentFolder],
  );

  const value: FoldersContextValue = {
    folders,
    currentFolder,
    currentCollection,
    draggedSidebarItem,
    isLoading,
    loadFolders,
    setFolders: useCallback((val) => {
      setFolders(val);
      state.setFolders(val);
    }, []),
    setCurrentFolder: useCallback((val) => setCurrentFolder(val), []),
    setCurrentCollection: useCallback((val) => setCurrentCollection(val), []),
    setDraggedSidebarItem: useCallback((val) => setDraggedSidebarItem(val), []),
    createFolder,
    updateFolder,
    deleteFolder,
    getRecursiveBookmarkCount,
  };

  return (
    <FoldersContext.Provider value={value}>{children}</FoldersContext.Provider>
  );
}

export function useFolders(): FoldersContextValue {
  const ctx = useContext(FoldersContext);
  if (!ctx) throw new Error("useFolders must be used within FoldersProvider");
  return ctx;
}
