type ReactNode,
useEffect,
} from "react";
import * as state from "../features/state.ts";
import type { Bookmark, Collection, FilterConfig, Folder, DashboardWidget } from "../types/index";

export const BOOKMARKS_PER_PAGE = 50;

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

interface BookmarksActions {
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

type BookmarksContextValue = BookmarksState & BookmarksActions;

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
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([]);
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

  useEffect(() => {
    return state.subscribe((key, value) => {
      switch (key) {
        case "bookmarks": setBookmarks(value as Bookmark[]); break;
        case "renderedBookmarks": setRenderedBookmarks(value as Bookmark[]); break;
        case "folders": setFolders(value as Folder[]); break;
        case "collections": setCollections(value as Collection[]); break;
        case "dashboardWidgets": setDashboardWidgets(value as DashboardWidget[]); break;
        case "totalCount": setTotalCount(value as number); break;
        case "filterConfig": setFilterConfig(value as FilterConfig); break;
        case "tagMetadata": setTagMetadata(value as any); break;
        case "displayedCount": setDisplayedCount(value as number); break;
        case "isLoading": setIsLoading(value as boolean); break;
        case "isLoadingMore": setIsLoadingMore(value as boolean); break;
        case "selectedBookmarks": setSelectedBookmarks(value as Set<string>); break;
        case "lastSelectedIndex": setLastSelectedIndex(value as number | null); break;
        case "bulkMode": setBulkMode(value as boolean); break;
      }
    });
  }, []);

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
