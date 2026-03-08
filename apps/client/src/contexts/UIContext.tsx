import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { TourStep } from "../types/index";

type ViewMode = "grid" | "list" | "compact";

interface TourState {
  active: boolean;
  currentStep: number;
  steps: TourStep[];
}

const defaultTourSteps: TourStep[] = [
  {
    title: "✨ Add Your First Bookmark",
    description: 'Click the "Add Bookmark" button to save your first link.',
    target: "sidebar-add-bookmark-btn",
    position: "bottom",
  },
  {
    title: "🔍 Search in Seconds",
    description: "Use Ctrl+K or / to search all your bookmarks instantly.",
    target: "search-input",
    position: "bottom",
  },
  {
    title: "🏷️ Organize with Tags",
    description:
      "Add tags to bookmarks for flexible filtering and organization.",
    target: "bookmark-tags",
    position: "bottom",
  },
];

interface UIState {
  currentView: string;
  viewMode: ViewMode;
  hideFavicons: boolean;
  hideSidebar: boolean;
  aiSuggestionsEnabled: boolean;
  includeChildBookmarks: boolean;
  snapToGrid: boolean;
  tourCompleted: boolean;
  richLinkPreviewsEnabled: boolean;
  tagCloudMaxTags: number;
  tagCloudDefaultShowAll: boolean;
  isFullscreen: boolean;
  isInitialLoad: boolean;
  showingAllTags: boolean;
  allSidebarTags: { name: string; count: number }[];
  tourState: TourState;
  lastTagRenameAction: { from: string; to: string } | null;
  viewToolbarConfig: Record<string, Record<string, unknown>>;
}

interface UIActions {
  setCurrentView: (val: string) => void;
  setViewMode: (val: ViewMode) => void;
  setHideFavicons: (val: boolean) => void;
  setHideSidebar: (val: boolean) => void;
  setAiSuggestionsEnabled: (val: boolean) => void;
  setIncludeChildBookmarks: (val: boolean) => void;
  setSnapToGrid: (val: boolean) => void;
  setTourCompleted: (val: boolean) => void;
  setRichLinkPreviewsEnabled: (val: boolean) => void;
  setTagCloudMaxTags: (val: number) => void;
  setTagCloudDefaultShowAll: (val: boolean) => void;
  setIsFullscreen: (val: boolean) => void;
  setIsInitialLoad: (val: boolean) => void;
  setShowingAllTags: (val: boolean) => void;
  setAllSidebarTags: (val: { name: string; count: number }[]) => void;
  setTourState: (val: TourState) => void;
  setLastTagRenameAction: (val: { from: string; to: string } | null) => void;
  setViewToolbarConfig: (
    view: string,
    config: Record<string, unknown>,
  ) => void;
}

type UIContextValue = UIState & UIActions;

const UIContext = createContext<UIContextValue | null>(null);

const defaultViewToolbarConfig: Record<string, Record<string, unknown>> = {
  dashboard: {
    title: "Dashboard",
    showViewToggle: false,
    showSearch: false,
    showAddButton: true,
    customActions: ["layout", "widgets", "settings"],
  },
  all: {
    title: "Bookmarks",
    showViewToggle: true,
    showSearch: true,
    showFilters: true,
    customActions: ["bulk-select"],
  },
  favorites: {
    title: "Favorites",
    showViewToggle: true,
    showSearch: true,
    showSort: true,
    customActions: [],
  },
  recent: {
    title: "Recent",
    showViewToggle: true,
    showSearch: true,
    showTimeRange: true,
    customActions: [],
  },
  archived: {
    title: "Archived",
    showViewToggle: true,
    showSearch: true,
    showSort: true,
    customActions: ["bulk-unarchive"],
  },
  analytics: {
    title: "Analytics",
    showViewToggle: false,
    showSearch: false,
    showAddButton: false,
    customActions: [],
  },
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentViewState] = useState("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [hideFavicons, setHideFavicons] = useState(false);
  const [hideSidebar, setHideSidebar] = useState(false);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  const [includeChildBookmarks, setIncludeChildBookmarks] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [richLinkPreviewsEnabled, setRichLinkPreviewsEnabled] = useState(false);
  const [tagCloudMaxTags, setTagCloudMaxTags] = useState(120);
  const [tagCloudDefaultShowAll, setTagCloudDefaultShowAll] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showingAllTags, setShowingAllTags] = useState(false);
  const [allSidebarTags, setAllSidebarTags] = useState<
    { name: string; count: number }[]
  >([]);
  const [tourState, setTourState] = useState<TourState>({
    active: false,
    currentStep: 0,
    steps: defaultTourSteps,
  });
  const [lastTagRenameAction, setLastTagRenameAction] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [viewToolbarConfig, setViewToolbarConfigState] = useState(
    defaultViewToolbarConfig,
  );

  // setCurrentView carries body class side-effects from the legacy system.
  // These will be removed as views are fully ported to React.
  const setCurrentView = useCallback((val: string) => {
    document.body.classList.toggle("dashboard-active", val === "dashboard");
    document.body.classList.toggle("tag-cloud-active", val === "tag-cloud");
    document.body.classList.toggle("analytics-active", val === "analytics");
    setCurrentViewState(val);
  }, []);

  const setViewToolbarConfig = useCallback(
    (view: string, config: Record<string, unknown>) => {
      setViewToolbarConfigState((prev) => ({
        ...prev,
        [view]: prev[view] ? { ...prev[view], ...config } : config,
      }));
    },
    [],
  );

  const value: UIContextValue = {
    currentView,
    viewMode,
    hideFavicons,
    hideSidebar,
    aiSuggestionsEnabled,
    includeChildBookmarks,
    snapToGrid,
    tourCompleted,
    richLinkPreviewsEnabled,
    tagCloudMaxTags,
    tagCloudDefaultShowAll,
    isFullscreen,
    isInitialLoad,
    showingAllTags,
    allSidebarTags,
    tourState,
    lastTagRenameAction,
    viewToolbarConfig,
    setCurrentView,
    setViewMode: useCallback((val) => setViewMode(val), []),
    setHideFavicons: useCallback((val) => setHideFavicons(val), []),
    setHideSidebar: useCallback((val) => setHideSidebar(val), []),
    setAiSuggestionsEnabled: useCallback(
      (val) => setAiSuggestionsEnabled(val),
      [],
    ),
    setIncludeChildBookmarks: useCallback(
      (val) => setIncludeChildBookmarks(val),
      [],
    ),
    setSnapToGrid: useCallback((val) => setSnapToGrid(val), []),
    setTourCompleted: useCallback((val) => setTourCompleted(val), []),
    setRichLinkPreviewsEnabled: useCallback(
      (val) => setRichLinkPreviewsEnabled(val),
      [],
    ),
    setTagCloudMaxTags: useCallback((val) => setTagCloudMaxTags(val), []),
    setTagCloudDefaultShowAll: useCallback(
      (val) => setTagCloudDefaultShowAll(val),
      [],
    ),
    setIsFullscreen: useCallback((val) => setIsFullscreen(val), []),
    setIsInitialLoad: useCallback((val) => setIsInitialLoad(val), []),
    setShowingAllTags: useCallback((val) => setShowingAllTags(val), []),
    setAllSidebarTags: useCallback((val) => setAllSidebarTags(val), []),
    setTourState: useCallback((val) => setTourState(val), []),
    setLastTagRenameAction: useCallback(
      (val) => setLastTagRenameAction(val),
      [],
    ),
    setViewToolbarConfig,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
