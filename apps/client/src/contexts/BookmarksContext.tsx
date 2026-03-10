import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect,
  useRef,
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
  viewFolderIds?: string[];
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
  viewFolderIds: string[];
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
  loadBookmarks: (options?: {
    folderId?: string | null;
    view?: string;
    filterOverride?: FilterConfig;
  }) => Promise<void>;
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
  setViewFolderIds: (val: string[]) => void;
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
  const [viewFolderIds, setViewFolderIds] = useState<string[]>([]);
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
  const loadBookmarksRequestSeq = useRef(0);

  // Sync current state into the bridge store so non-React code always reads fresh values
  useEffect(() => {
    syncBookmarksBridge({
      bookmarks,
      renderedBookmarks,
      totalCount,
      selectedBookmarks,
      bulkMode,
      filterConfig,
      setBookmarks,
      setRenderedBookmarks,
      setTotalCount,
      setSelectedBookmarks,
      setBulkMode,
      setFilterConfig,
      loadBookmarks,
    });
  }, [
    bookmarks,
    renderedBookmarks,
    totalCount,
    selectedBookmarks,
    bulkMode,
    filterConfig,
  ]);

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

  const loadBookmarks = useCallback(
    async (options?: {
      folderId?: string | null;
      view?: string;
      filterOverride?: FilterConfig;
    }) => {
    const requestSeq = ++loadBookmarksRequestSeq.current;
    try {
      const uiBridge = getUIBridge();
      const currentFolder = options?.folderId ?? uiBridge.getCurrentFolder();
      const currentView = options?.view ?? uiBridge.getCurrentView();
      const includeChildBookmarks = uiBridge.getIncludeChildBookmarks();
      const activeFilters = options?.filterOverride ?? filterConfig;

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
      if (currentView === "most-used") params.append("most_used", "true");

      // Folder navigation ("folder" view) or sidebar folder filter (all other views)
      const folderFilter = currentView === "folder"
        ? currentFolder
        : (activeFilters.folder ?? null);
      if (folderFilter && currentView !== "dashboard" && currentView !== "collection") {
        params.append("folder_id", folderFilter);
        if (currentView === "folder" && includeChildBookmarks) {
          params.append("include_children", "true");
        }
      }

      if (activeFilters.tags?.length) {
        params.append("tags", activeFilters.tags.join(","));
        params.append("tagMode", activeFilters.tagMode || "OR");
      }
      if (activeFilters.search) {
        params.append("search", activeFilters.search);
      }
      // most-used view always sorts by click count; respect filterConfig for other views
      if (currentView === "most-used") {
        params.append("sort", "most_visited");
      } else if (activeFilters.sort) {
        params.append("sort", activeFilters.sort);
      }

      const queryString = params.toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      // DIAGNOSTIC: Log the actual request
      console.log("🔍 DIAGNOSTIC - loadBookmarks request:", {
        url,
        currentView,
        currentFolder,
        includeChildBookmarks,
        activeFilters,
        requestSeq,
      });

      const data = await api<BookmarksListResponse>(url, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      // DIAGNOSTIC: Log the response
      console.log("🔍 DIAGNOSTIC - loadBookmarks response:", {
        bookmarkCount: data.bookmarks?.length || 0,
        total: data.total,
        requestSeq,
        currentRequestSeq: loadBookmarksRequestSeq.current,
        willIgnore: requestSeq !== loadBookmarksRequestSeq.current,
      });

      // Ignore stale responses when a newer loadBookmarks call has started.
      if (requestSeq !== loadBookmarksRequestSeq.current) {
        console.log("⚠️ DIAGNOSTIC - Ignoring stale response");
        return;
      }

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
      if (data.viewFolderIds) {
        setViewFolderIds(data.viewFolderIds);
      }
    } catch (err) {
      console.error("Failed to load bookmarks:", err);
    } finally {
      if (requestSeq === loadBookmarksRequestSeq.current) {
        setIsLoading(false);
      }
    }
    },
    [resetPagination, filterConfig],
  );

  const loadMoreBookmarks = useCallback(async () => {
    if (isLoadingMore || displayedCount >= totalCount) return;

    setIsLoadingMore(true);

    try {
      const uiBridge = getUIBridge();
      const currentFolder = uiBridge.getCurrentFolder();
      const currentView = uiBridge.getCurrentView();
      const includeChildBookmarks = uiBridge.getIncludeChildBookmarks();

      const params = new URLSearchParams();
      params.append("offset", String(displayedCount));
      params.append("limit", String(BOOKMARKS_PER_PAGE));

      if (currentView === "favorites") params.append("favorites", "true");
      if (currentView === "archived") params.append("archived", "true");
      if (currentView === "most-used") params.append("most_used", "true");

      if (
        currentFolder &&
        currentView !== "dashboard" &&
        currentView !== "collection" &&
        currentView !== "favorites" &&
        currentView !== "archived" &&
        currentView !== "recent" &&
        currentView !== "most-used"
      ) {
        params.append("folder_id", currentFolder);
        if (includeChildBookmarks) {
          params.append("include_children", "true");
        }
      }

      if (filterConfig.tags?.length) {
        params.append("tags", filterConfig.tags.join(","));
        params.append("tagMode", filterConfig.tagMode || "OR");
      }
      if (filterConfig.search) {
        params.append("search", filterConfig.search);
      }
      if (currentView === "most-used") {
        params.append("sort", "most_visited");
      } else if (filterConfig.sort) {
        params.append("sort", filterConfig.sort);
      }

      const data = await api<BookmarksListResponse>(`/bookmarks?${params}`, {
        headers: {
          "Cache-Control": "no-cache",
        },
      });
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
    viewFolderIds,
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
    setViewFolderIds: useCallback((val) => setViewFolderIds(val), []),
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
  if (ctx) return ctx;

  // Fallback for non-React consumers (tests or legacy code). Use the
  // vanilla state module so code that expects the hook to work without the
  // provider (unit tests) still functions.
  let state: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    state = require("../features/state");
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      state = require("@features/state.ts");
    } catch {
      state = null;
    }
  }

  return {
    bookmarks: state?.bookmarks,
    renderedBookmarks: state?.renderedBookmarks,
    folders: state?.folders,
    collections: state?.collections,
    dashboardWidgets: state?.dashboardWidgets,
    totalCount: state?.totalCount,
    widgetDataCache: state?.widgetDataCache,
    filterConfig: state?.filterConfig,
    tagMetadata: state?.tagMetadata,
    viewFolderIds: state?.viewFolderIds ?? [],
    displayedCount: state?.displayedCount,
    isLoading: state?.isLoading,
    isLoadingMore: state?.isLoadingMore,
    selectedBookmarks: state?.selectedBookmarks,
    lastSelectedIndex: state?.lastSelectedIndex,
    bulkMode: state?.bulkMode,
    loadBookmarks: async () => state?.loadBookmarks && state.loadBookmarks(),
    loadMoreBookmarks: async () =>
      state?.loadMoreBookmarks && state.loadMoreBookmarks(),
    setBookmarks: (val: any) => state?.setBookmarks && state.setBookmarks(val),
    setRenderedBookmarks: (val: any) =>
      state?.setRenderedBookmarks && state.setRenderedBookmarks(val),
    setFolders: (val: any) => state?.setFolders && state.setFolders(val),
    setCollections: (val: any) =>
      state?.setCollections && state.setCollections(val),
    setDashboardWidgets: (val: any) =>
      state?.setDashboardWidgets && state.setDashboardWidgets(val),
    setTotalCount: (val: number) =>
      state?.setTotalCount && state.setTotalCount(val),
    setWidgetDataCache: (id: string, val: any) =>
      state?.setWidgetDataCache && state.setWidgetDataCache(id, val),
    clearWidgetDataCache: () =>
      state?.clearWidgetDataCache && state.clearWidgetDataCache(),
    setFilterConfig: (val: any) =>
      state?.setFilterConfig && state.setFilterConfig(val),
    setTagMetadata: (val: any) =>
      state?.setTagMetadata && state.setTagMetadata(val),
    setViewFolderIds: (val: string[]) =>
      state?.setViewFolderIds && state.setViewFolderIds(val),
    setDisplayedCount: (val: number) =>
      state?.setDisplayedCount && state.setDisplayedCount(val),
    setIsLoading: (val: boolean) =>
      state?.setIsLoading && state.setIsLoading(val),
    setIsLoadingMore: (val: boolean) =>
      state?.setIsLoadingMore && state.setIsLoadingMore(val),
    setSelectedBookmarks: (val: Set<string>) =>
      state?.setSelectedBookmarks && state.setSelectedBookmarks(val),
    setLastSelectedIndex: (val: number | null) =>
      state?.setLastSelectedIndex && state.setLastSelectedIndex(val),
    setBulkMode: (val: boolean) => state?.setBulkMode && state.setBulkMode(val),
    resetPagination: () => state?.resetPagination && state.resetPagination(),
    fetchTagStats: async () =>
      state?.fetchTagStats ? state.fetchTagStats() : [],
    renameTag: async (from: string, to: string) =>
      state?.renameTag && state.renameTag(from, to),
    deleteTag: async (id: string, name: string) =>
      state?.deleteTag && state.deleteTag(id, name),
    updateTag: async (id: string, name: string, color?: string) =>
      state?.updateTag && state.updateTag(id, name, color),
    createTag: async (name: string, color?: string) =>
      state?.createTag ? state.createTag(name, color) : false,
  } as BookmarksContextValue;
}
