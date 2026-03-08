import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect,
} from "react";
import { syncBookmarksBridge, getUIBridge } from "./context-bridge";
import { api } from "../services/api.ts";
import { showToast } from "./ToastContext";
import { showConfirm } from "./ConfirmContext";
import { logger } from "@utils/logger";
import type {
  Bookmark,
  Collection,
  FilterConfig,
  Folder,
  DashboardWidget,
} from "../types/index";

interface TagStatItem {
  id: string;
  name: string;
  count: number;
  color?: string;
  parent?: string;
}

export const BOOKMARKS_PER_PAGE = 50;

interface BookmarksListResponse {
  bookmarks: Bookmark[];
  total: number;
  tags?: Array<{
    name: string;
    color?: string;
    icon?: string;
    id?: string;
    count?: number;
  }>;
}

interface BookmarksState {
  bookmarks: Bookmark[];
  renderedBookmarks: Bookmark[];
  folders: Folder[];
  collections: Collection[];
  dashboardWidgets: DashboardWidget[];
  totalCount: number;
  widgetDataCache: Record<string, Bookmark[]>;
  filterConfig: FilterConfig;
  tagMetadata: Record<
    string,
    { color?: string; icon?: string; id?: string; count?: number }
  >;
  displayedCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  selectedBookmarks: Set<string>;
  lastSelectedIndex: number | null;
  bulkMode: boolean;
}

interface TagManagementMethods {
  fetchTagStats: () => Promise<TagStatItem[]>;
  renameTag: (from: string, to: string) => Promise<void>;
  deleteTag: (id: string, name: string) => Promise<void>;
  updateTag: (id: string, name: string, color?: string) => Promise<void>;
  createTag: (name: string, color?: string) => Promise<boolean>;
}

interface BookmarksActions {
  loadBookmarks: () => Promise<void>;
  loadMoreBookmarks: () => Promise<void>;
  setBookmarks: (val: Bookmark[]) => void;
  setRenderedBookmarks: (val: Bookmark[]) => void;
  setFolders: (val: Folder[]) => void;
  setCollections: (val: Collection[]) => void;
  setDashboardWidgets: (val: DashboardWidget[]) => void;
  setTotalCount: (val: number) => void;
  setWidgetDataCache: (id: string, val: Bookmark[]) => void;
  clearWidgetDataCache: () => void;
  setFilterConfig: (val: FilterConfig) => void;
  setTagMetadata: (
    val: Record<
      string,
      { color?: string; icon?: string; id?: string; count?: number }
    >,
  ) => void;
  setDisplayedCount: (val: number) => void;
  setIsLoading: (val: boolean) => void;
  setIsLoadingMore: (val: boolean) => void;
  setSelectedBookmarks: (val: Set<string>) => void;
  setLastSelectedIndex: (val: number | null) => void;
  setBulkMode: (val: boolean) => void;
  resetPagination: () => void;
}

type BookmarksContextValue = BookmarksState &
  BookmarksActions &
  TagManagementMethods;

const BookmarksContext = createContext<BookmarksContextValue | null>(null);

const initialFilterConfig: FilterConfig = {
  sort: "recently_added",
  tags: [],
  tagSort: "count_desc",
  tagMode: "OR",
};

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [renderedBookmarks, setRenderedBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(
    [],
  );
  const [totalCount, setTotalCount] = useState(0);
  const [widgetDataCache, setWidgetDataCacheState] = useState<
    Record<string, Bookmark[]>
  >({});
  const [filterConfig, setFilterConfig] =
    useState<FilterConfig>(initialFilterConfig);
  const [tagMetadata, setTagMetadata] = useState<
    Record<
      string,
      { color?: string; icon?: string; id?: string; count?: number }
    >
  >({});
  const [displayedCount, setDisplayedCount] = useState(BOOKMARKS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(
    new Set(),
  );
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null,
  );
  const [bulkMode, setBulkMode] = useState(false);

  // Sync current state into the bridge store so non-React code always reads fresh values
  useEffect(() => {
    syncBookmarksBridge({
      bookmarks,
      renderedBookmarks,
      totalCount,
      selectedBookmarks,
      bulkMode,
      setBookmarks,
      setRenderedBookmarks,
      setTotalCount,
      setSelectedBookmarks,
      setBulkMode,
    });
  }, [bookmarks, renderedBookmarks, totalCount, selectedBookmarks, bulkMode]);

  const setWidgetDataCache = useCallback((id: string, val: Bookmark[]) => {
    setWidgetDataCacheState((prev) => ({ ...prev, [id]: val }));
  }, []);

  const clearWidgetDataCache = useCallback(() => {
    setWidgetDataCacheState({});
  }, []);

  const resetPagination = useCallback(() => {
    setDisplayedCount(BOOKMARKS_PER_PAGE);
    setTotalCount(0);
  }, []);

  const loadBookmarks = useCallback(async () => {
    try {
      const uiBridge = getUIBridge();
      const currentFolder = uiBridge.getCurrentFolder();
      const currentView = uiBridge.getCurrentView();

      // Get current collection from URL or state if we're in collection view
      let currentCollection: string | null = null;
      if (currentView === "collection") {
        const url = new URL(window.location.href);
        currentCollection = url.searchParams.get("collection");
      }

      if (currentView === "analytics") return;

      setIsLoading(true);
      resetPagination();

      const params = new URLSearchParams();
      params.append("limit", String(BOOKMARKS_PER_PAGE));

      let endpoint = "/bookmarks";

      if (currentView === "collection" && currentCollection) {
        endpoint = `/collections/${currentCollection}/bookmarks`;
      }

      if (currentView === "favorites") params.append("favorites", "true");
      if (currentView === "archived") params.append("archived", "true");

      if (
        currentFolder &&
        currentView !== "dashboard" &&
        currentView !== "collection" &&
        currentView !== "favorites" &&
        currentView !== "archived" &&
        currentView !== "recent"
      ) {
        params.append("folder_id", currentFolder);
      }

      if (filterConfig.tags?.length) {
        filterConfig.tags.forEach((t: string) => params.append("tag", t));
      }
      if (filterConfig.search) {
        params.append("search", filterConfig.search);
      }
      if (filterConfig.sort) {
        params.append("sort", filterConfig.sort);
      }

      const queryString = params.toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      const data = await api<BookmarksListResponse>(url);
      setBookmarks(data.bookmarks);
      setRenderedBookmarks(data.bookmarks);
      setTotalCount(data.total || data.bookmarks.length);

      if (data.tags) {
        const metadata: Record<
          string,
          { color?: string; icon?: string; id?: string; count?: number }
        > = {};
        data.tags.forEach(
          (t: {
            name: string;
            color?: string;
            icon?: string;
            id?: string;
            count?: number;
          }) => {
            metadata[t.name] = {
              color: t.color,
              icon: t.icon,
              id: t.id,
              count: t.count,
            };
          },
        );
        setTagMetadata(metadata);
      }
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [resetPagination, filterConfig]);

  const loadMoreBookmarks = useCallback(async () => {
    if (isLoadingMore || displayedCount >= totalCount) return;

    setIsLoadingMore(true);

    try {
      const params = new URLSearchParams();
      params.append("offset", String(displayedCount));
      params.append("limit", String(BOOKMARKS_PER_PAGE));

      if (filterConfig.tags?.length) {
        filterConfig.tags.forEach((t: string) => params.append("tag", t));
      }
      if (filterConfig.search) {
        params.append("search", filterConfig.search);
      }
      if (filterConfig.sort) {
        params.append("sort", filterConfig.sort);
      }

      const data = await api<BookmarksListResponse>(`/bookmarks?${params}`);
      const newBookmarks = [...bookmarks, ...data.bookmarks];
      setBookmarks(newBookmarks);
      setRenderedBookmarks(newBookmarks);
      setDisplayedCount((prev) => prev + data.bookmarks.length);
    } catch (err) {
      console.error("Failed to load more bookmarks:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, displayedCount, totalCount, bookmarks, filterConfig]);

  // Tag Management Methods
  const fetchTagStats = useCallback(async (): Promise<TagStatItem[]> => {
    try {
      const tags = await api<TagStatItem[]>("/tags");
      if (!tags || tags.length === 0) return [];

      const sortMode = filterConfig.tagSort || "count_desc";
      tags.sort((a, b) => {
        switch (sortMode) {
          case "count_asc":
            return a.count - b.count;
          case "name_asc":
            return a.name.localeCompare(b.name);
          case "name_desc":
            return b.name.localeCompare(a.name);
          case "count_desc":
          default:
            return b.count - a.count;
        }
      });
      return tags;
    } catch (err) {
      logger.error("Failed to fetch tag stats:", err);
      return [];
    }
  }, [filterConfig.tagSort]);

  const renameTag = useCallback(
    async (from: string, to: string): Promise<void> => {
      if (!from || !to) return;

      try {
        await api("/tags/rename", {
          method: "POST",
          body: JSON.stringify({ from, to }),
        });

        // Update bookmarks with renamed tag
        const updatedBookmarks = bookmarks.map((b) => {
          if (!b.tags) return b;
          const tags = b.tags
            .split(",")
            .map((t) => t.trim())
            .map((t) => (t === from ? to : t));
          const merged = Array.from(new Set(tags)).join(", ");
          return { ...b, tags: merged };
        });

        setBookmarks(updatedBookmarks);

        // Trigger re-render
        const event = new CustomEvent("tag-updated");
        window.dispatchEvent(event);

        showToast(`Renamed ${from} → ${to}`, "success");
      } catch (err) {
        logger.error("Failed to rename tag:", err);
        showToast("Failed to rename tag", "error");
      }
    },
    [bookmarks],
  );

  const deleteTag = useCallback(
    async (id: string, name: string): Promise<void> => {
      const confirmed = await showConfirm(
        `Delete tag "${name}"? It will be removed from all bookmarks.`,
        { title: "Delete Tag", destructive: true },
      );

      if (!confirmed) return;

      try {
        await api(`/tags/${id}`, { method: "DELETE" });

        // Trigger re-render
        const event = new CustomEvent("tag-updated");
        window.dispatchEvent(event);

        showToast(`Tag "${name}" deleted`, "success");
      } catch (err) {
        logger.error("Failed to delete tag:", err);
        showToast("Failed to delete tag", "error");
      }
    },
    [],
  );

  const updateTag = useCallback(
    async (id: string, name: string, color?: string): Promise<void> => {
      if (!name) return;

      try {
        await api(`/tags/${id}`, {
          method: "PUT",
          body: JSON.stringify({ name, color }),
        });

        // Trigger re-render
        const event = new CustomEvent("tag-updated");
        window.dispatchEvent(event);

        showToast("Tag updated successfully", "success");
      } catch (err) {
        logger.error("Failed to update tag:", err);
        showToast("Failed to update tag", "error");
      }
    },
    [],
  );

  const createTag = useCallback(
    async (name: string, color?: string): Promise<boolean> => {
      if (!name || !name.trim()) {
        showToast("Tag name is required", "error");
        return false;
      }

      try {
        await api("/tags", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), color }),
        });

        showToast("Tag created successfully", "success");
        return true;
      } catch (err) {
        logger.error("Failed to create tag:", err);
        showToast("Failed to create tag", "error");
        return false;
      }
    },
    [],
  );

  const value: BookmarksContextValue = {
    bookmarks,
    renderedBookmarks,
    folders,
    collections,
    dashboardWidgets,
    totalCount,
    widgetDataCache,
    filterConfig,
    tagMetadata,
    displayedCount,
    isLoading,
    isLoadingMore,
    selectedBookmarks,
    lastSelectedIndex,
    bulkMode,
    loadBookmarks,
    loadMoreBookmarks,
    setBookmarks: useCallback((val) => setBookmarks(val), []),
    setRenderedBookmarks: useCallback((val) => setRenderedBookmarks(val), []),
    setFolders: useCallback((val) => setFolders(val), []),
    setCollections: useCallback((val) => setCollections(val), []),
    setDashboardWidgets: useCallback((val) => setDashboardWidgets(val), []),
    setTotalCount: useCallback((val) => setTotalCount(val), []),
    setWidgetDataCache,
    clearWidgetDataCache,
    setFilterConfig: useCallback((val) => setFilterConfig(val), []),
    setTagMetadata: useCallback((val) => setTagMetadata(val), []),
    setDisplayedCount: useCallback((val) => setDisplayedCount(val), []),
    setIsLoading: useCallback((val) => setIsLoading(val), []),
    setIsLoadingMore: useCallback((val) => setIsLoadingMore(val), []),
    setSelectedBookmarks: useCallback((val) => setSelectedBookmarks(val), []),
    setLastSelectedIndex: useCallback((val) => setLastSelectedIndex(val), []),
    setBulkMode: useCallback((val) => setBulkMode(val), []),
    resetPagination,
    fetchTagStats,
    renameTag,
    deleteTag,
    updateTag,
    createTag,
  };

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks(): BookmarksContextValue {
  const ctx = useContext(BookmarksContext);
  if (!ctx)
    throw new Error("useBookmarks must be used within BookmarksProvider");
  return ctx;
}
