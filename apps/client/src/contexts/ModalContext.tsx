import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { registerModalDispatcher } from "@utils/modal-controller";

export interface BookmarkFormData {
  id?: string;
  url: string;
  title: string;
  description: string;
  tags: string;
  note: string;
  folderId: string | null;
  color?: string;
}

export interface TagFormData {
  id?: string;
  name: string;
  color: string;
}

export interface FolderFormData {
  id?: string;
  name: string;
  parentId: string | null;
  color: string;
}

export type ModalType =
  | "bookmark"
  | "tag"
  | "folder"
  | "settings"
  | "filter"
  | "tour"
  | null;

interface ModalState {
  openModal: ModalType;
  bookmarkFormData: BookmarkFormData;
  tagFormData: TagFormData;
  folderFormData: FolderFormData;
  settingsActiveTab: string;
}

interface ModalActions {
  openBookmarkModal: (data?: Partial<BookmarkFormData>) => void;
  openTagModal: (data: { id?: string; name: string; color?: string }) => void;
  openFolderModal: (data?: Partial<FolderFormData>) => void;
  openSettingsModal: (tab?: string) => void;
  openFilterModal: () => void;
  openTourModal: () => void;
  closeModal: () => void;
  setBookmarkFormData: (data: Partial<BookmarkFormData>) => void;
  setTagFormData: (data: Partial<TagFormData>) => void;
  setFolderFormData: (data: Partial<FolderFormData>) => void;
  setSettingsActiveTab: (tab: string) => void;
}

const initialBookmarkFormData: BookmarkFormData = {
  url: "",
  title: "",
  description: "",
  tags: "",
  note: "",
  folderId: null,
  color: "",
};

const initialTagFormData: TagFormData = {
  name: "",
  color: "#f59e0b",
};

const initialFolderFormData: FolderFormData = {
  name: "",
  parentId: null,
  color: "#6366f1",
};

const ModalContext = createContext<(ModalState & ModalActions) | undefined>(
  undefined,
);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [bookmarkFormData, setBookmarkFormDataState] =
    useState<BookmarkFormData>(initialBookmarkFormData);
  const [tagFormData, setTagFormDataState] =
    useState<TagFormData>(initialTagFormData);
  const [folderFormData, setFolderFormDataState] = useState<FolderFormData>(
    initialFolderFormData,
  );
  const [settingsActiveTab, setSettingsActiveTabState] = useState("general");

  const closeModal = useCallback(() => {
    setOpenModal(null);
  }, []);

  const openBookmarkModal = useCallback((data?: Partial<BookmarkFormData>) => {
    setBookmarkFormDataState({
      ...initialBookmarkFormData,
      ...data,
    });
    setOpenModal("bookmark");
  }, []);

  const openTagModal = useCallback(
    ({
      id,
      name,
      color = "#f59e0b",
    }: {
      id?: string;
      name: string;
      color?: string;
    }) => {
      setTagFormDataState({ id, name, color });
      setOpenModal("tag");
    },
    [],
  );

  const openFolderModal = useCallback((data?: Partial<FolderFormData>) => {
    setFolderFormDataState({
      ...initialFolderFormData,
      ...data,
    });
    setOpenModal("folder");
  }, []);

  const openSettingsModal = useCallback((tab?: string) => {
    if (tab) {
      setSettingsActiveTabState(tab);
    }
    setOpenModal("settings");
  }, []);

  const openFilterModal = useCallback(() => {
    setOpenModal("filter");
  }, []);

  const openTourModal = useCallback(() => {
    setOpenModal("tour");
  }, []);

  const setBookmarkFormData = useCallback((data: Partial<BookmarkFormData>) => {
    setBookmarkFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const setTagFormData = useCallback((data: Partial<TagFormData>) => {
    setTagFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const setFolderFormData = useCallback((data: Partial<FolderFormData>) => {
    setFolderFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const setSettingsActiveTab = useCallback((tab: string) => {
    setSettingsActiveTabState(tab);
  }, []);

  const value: ModalState & ModalActions = {
    openModal,
    bookmarkFormData,
    tagFormData,
    folderFormData,
    settingsActiveTab,
    openBookmarkModal,
    openTagModal,
    openFolderModal,
    openSettingsModal,
    openFilterModal,
    openTourModal,
    closeModal,
    setBookmarkFormData,
    setTagFormData,
    setFolderFormData,
    setSettingsActiveTab,
  };

  // Register dispatcher on mount so legacy API can work
  useEffect(() => {
    registerModalDispatcher((action) => {
      switch (action.type) {
        case "open-bookmark":
          openBookmarkModal(action.payload);
          break;
        case "open-tag": {
          const { id, name = "", color = "#f59e0b" } = action.payload || {};
          openTagModal({ id, name, color });
          break;
        }
        case "open-folder":
          openFolderModal(action.payload);
          break;
        case "open-settings": {
          const { tab } = action.payload || {};
          openSettingsModal(tab);
          break;
        }
        case "close":
          closeModal();
          break;
        default:
          console.warn("Unknown modal action:", action);
      }
    });
  }, [
    openBookmarkModal,
    openTagModal,
    openFolderModal,
    openSettingsModal,
    closeModal,
  ]);

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
