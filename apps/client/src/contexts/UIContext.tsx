import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  subscribe,
  setCurrentView as vanillaSetCurrentView,
} from "../features/state";
import { syncUIBridge } from "./context-bridge";
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
  currentFolder: string | null;
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
  isWidgetPickerOpen: boolean;
  showingAllTags: boolean;
  allSidebarTags: { name: string; count: number }[];
  tourState: TourState;
  lastTagRenameAction: { from: string; to: string } | null;
  viewToolbarConfig: Record<string, Record<string, unknown>>;
}

interface UIActions {
  setCurrentView: (val: string) => Promise<void>;
  setCurrentFolder: (val: string | null) => void;
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
  setIsWidgetPickerOpen: (val: boolean) => void;
  setShowingAllTags: (val: boolean) => void;
  setAllSidebarTags: (val: { name: string; count: number }[]) => void;
  setTourState: (val: TourState) => void;
  setLastTagRenameAction: (val: { from: string; to: string } | null) => void;
  setViewToolbarConfig: (view: string, config: Record<string, unknown>) => void;
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
  const [currentFolder, setCurrentFolderState] = useState<string | null>(null);
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
  const [isWidgetPickerOpen, setIsWidgetPickerOpen] = useState(false);
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

  useEffect(() => {
    return subscribe((key, value) => {
      if (key === "isWidgetPickerOpen") {
        setIsWidgetPickerOpen(value as boolean);
      } else if (key === "currentFolder") {
        setCurrentFolderState(value as string | null);
      } else if (key === "currentView") {
        setCurrentViewState(value as string);
      }
    });
  }, []);

  // setCurrentView syncs with vanilla state for cleanup and legacy code compatibility
  const setCurrentView = useCallback(async (val: string) => {
    // Call vanilla state's setCurrentView which handles all cleanup
    await vanillaSetCurrentView(val);
    // The React state will be updated via the subscribe listener above
    // But we also set it here immediately to avoid any race conditions
    setCurrentViewState(val);
  }, []);

  const setCurrentFolder = useCallback((val: string | null) => {
    setCurrentFolderState(val);
  }, []);

  // Sync current state into the bridge store so non-React code always reads fresh values
  useEffect(() => {
    syncUIBridge({
      currentView,
      currentFolder,
      includeChildBookmarks,
      hideSidebar,
      setCurrentView,
      setCurrentFolder,
      setHideSidebar,
      setViewMode: (val) => setViewMode(val as ViewMode),
      setHideFavicons: (val) => setHideFavicons(val),
      setAiSuggestionsEnabled: (val) => setAiSuggestionsEnabled(val),
      setRichLinkPreviewsEnabled: (val) => setRichLinkPreviewsEnabled(val),
      setIncludeChildBookmarks: (val) => setIncludeChildBookmarks(val),
      setSnapToGrid: (val) => setSnapToGrid(val),
      setTourCompleted: (val) => setTourCompleted(val),
      setTagCloudMaxTags: (val) => setTagCloudMaxTags(val),
      setTagCloudDefaultShowAll: (val) => setTagCloudDefaultShowAll(val),
    });
  }, [currentView, currentFolder, includeChildBookmarks, hideSidebar]);

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
    currentFolder,
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
    isWidgetPickerOpen,
    showingAllTags,
    allSidebarTags,
    tourState,
    lastTagRenameAction,
    viewToolbarConfig,
    setCurrentView,
    setCurrentFolder,
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
    setIsWidgetPickerOpen: useCallback((val) => setIsWidgetPickerOpen(val), []),
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
  if (ctx) return ctx;

  // Fallback for non-React consumers (tests or legacy code). Read from the
  // vanilla state module so tests that mock @features/state.ts still work
  // without mounting the React provider.
  // Try to read vanilla state defensively. Use a dynamic require so tests
  // that mock path aliases don't throw at module-eval time. Guard access
  // to avoid exceptions when mocks don't provide all exports.
  let state: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    state = require("../features/state");
  } catch {
    try {
      // Fallback to alias path if relative resolution fails
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      state = require("@features/state.ts");
    } catch {
      state = null;
    }
  }

  return {
    currentView: state?.currentView ?? "dashboard",
    currentFolder: state?.currentFolder ?? null,
    viewMode: (state?.viewMode as ViewMode) ?? "grid",
    hideFavicons: state?.hideFavicons ?? false,
    hideSidebar: state?.hideSidebar ?? false,
    aiSuggestionsEnabled: state?.aiSuggestionsEnabled ?? true,
    includeChildBookmarks: state?.includeChildBookmarks ?? false,
    snapToGrid: state?.snapToGrid ?? true,
    tourCompleted: state?.tourCompleted ?? false,
    richLinkPreviewsEnabled: state?.richLinkPreviewsEnabled ?? false,
    tagCloudMaxTags: state?.tagCloudMaxTags ?? 120,
    tagCloudDefaultShowAll: state?.tagCloudDefaultShowAll ?? false,
    isFullscreen: state?.isFullscreen ?? false,
    isInitialLoad: state?.isInitialLoad ?? true,
    isWidgetPickerOpen: state?.isWidgetPickerOpen ?? false,
    showingAllTags: state?.showingAllTags ?? false,
    allSidebarTags: state?.allSidebarTags ?? [],
    tourState: state?.tourState ?? {
      active: false,
      currentStep: 0,
      steps: defaultTourSteps,
    },
    lastTagRenameAction: state?.lastTagRenameAction ?? null,
    viewToolbarConfig: state?.viewToolbarConfig ?? defaultViewToolbarConfig,
    setCurrentView: async (val: string) =>
      state?.setCurrentView && state.setCurrentView(val),
    setCurrentFolder: (val: string | null) =>
      state?.setCurrentFolder && state.setCurrentFolder(val),
    setViewMode: (val: ViewMode) =>
      state?.setViewMode && state.setViewMode(val),
    setHideFavicons: (val: boolean) =>
      state?.setHideFavicons && state.setHideFavicons(val),
    setHideSidebar: (val: boolean) =>
      state?.setHideSidebar && state.setHideSidebar(val),
    setAiSuggestionsEnabled: (val: boolean) =>
      state?.setAiSuggestionsEnabled && state.setAiSuggestionsEnabled(val),
    setIncludeChildBookmarks: (val: boolean) =>
      state?.setIncludeChildBookmarks && state.setIncludeChildBookmarks(val),
    setSnapToGrid: (val: boolean) =>
      state?.setSnapToGrid && state.setSnapToGrid(val),
    setTourCompleted: (val: boolean) =>
      state?.setTourCompleted && state.setTourCompleted(val),
    setRichLinkPreviewsEnabled: (val: boolean) =>
      state?.setRichLinkPreviewsEnabled &&
      state.setRichLinkPreviewsEnabled(val),
    setTagCloudMaxTags: (val: number) =>
      state?.setTagCloudMaxTags && state.setTagCloudMaxTags(val),
    setTagCloudDefaultShowAll: (val: boolean) =>
      state?.setTagCloudDefaultShowAll && state.setTagCloudDefaultShowAll(val),
    setIsFullscreen: (val: boolean) =>
      state?.setIsFullscreen && state.setIsFullscreen(val),
    setIsInitialLoad: (val: boolean) =>
      state?.setIsInitialLoad && state.setIsInitialLoad(val),
    setIsWidgetPickerOpen: (val: boolean) =>
      state?.setIsWidgetPickerOpen && state.setIsWidgetPickerOpen(val),
    setShowingAllTags: (val: boolean) =>
      state?.setShowingAllTags && state.setShowingAllTags(val),
    setAllSidebarTags: (val: { name: string; count: number }[]) =>
      state?.setAllSidebarTags && state.setAllSidebarTags(val),
    setTourState: (val: TourState) =>
      state?.setTourState && state.setTourState(val),
    setLastTagRenameAction: (val: { from: string; to: string } | null) =>
      state?.setLastTagRenameAction && state.setLastTagRenameAction(val),
    setViewToolbarConfig: (view: string, config: Record<string, unknown>) =>
      state?.setViewToolbarConfig && state.setViewToolbarConfig(view, config),
  } as UIContextValue;
}
