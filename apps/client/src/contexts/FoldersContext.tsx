import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Folder, Tag } from "../types/index";

interface FoldersState {
  folders: Folder[];
  currentFolder: string | null;
  currentCollection: string | null;
  draggedSidebarItem: Folder | Tag | null;
}

interface FoldersActions {
  setFolders: (val: Folder[]) => void;
  setCurrentFolder: (val: string | null) => void;
  setCurrentCollection: (val: string | null) => void;
  setDraggedSidebarItem: (val: Folder | Tag | null) => void;
}

type FoldersContextValue = FoldersState & FoldersActions;

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

  const value: FoldersContextValue = {
    folders,
    currentFolder,
    currentCollection,
    draggedSidebarItem,
    setFolders: useCallback((val) => setFolders(val), []),
    setCurrentFolder: useCallback((val) => setCurrentFolder(val), []),
    setCurrentCollection: useCallback((val) => setCurrentCollection(val), []),
    setDraggedSidebarItem: useCallback((val) => setDraggedSidebarItem(val), []),
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
