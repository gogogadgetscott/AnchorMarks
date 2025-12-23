import type { UserSettings } from "@/types";

export function applyTheme(settings: UserSettings) {
  if (settings.theme === 'system') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', settings.theme);
  }
  document.body.setAttribute('data-high-contrast', String(settings.highContrast));
}
/**
 * AnchorMarks - Global State Module
 * Manages all shared application state
 */

import {
  User,
  Bookmark,
  Folder,
  DashboardWidget,
  FilterConfig,
  Tag,
  TourStep,
  Command,
} from "@types";

// API Configuration
export const API_BASE = "/api";

// Authentication State
export let authToken: string | null = null;
export let csrfToken: string | null = null;
export let currentUser: User | null = null;
export let isAuthenticated: boolean = false;

// Data State
export let bookmarks: Bookmark[] = [];
export let folders: Folder[] = [];
export let renderedBookmarks: Bookmark[] = [];
export let collections: any[] = [];

// UI State
export let currentDashboardTab: string | null = null;
export let currentView: string = "dashboard";
export let currentFolder: string | null = null;
export let currentCollection: string | null = null;
export let viewMode: "grid" | "list" | "compact" = "grid";
export let hideFavicons: boolean = false;
export let hideSidebar: boolean = false;
export let aiSuggestionsEnabled: boolean = true;
export let includeChildBookmarks: boolean = false;
export let snapToGrid: boolean = true;
export let tourCompleted: boolean = false;
export let richLinkPreviewsEnabled: boolean = false;
// Tag Cloud Settings
export let tagCloudMaxTags: number = 120;
export let tagCloudDefaultShowAll: boolean = false;

// Dashboard State
export let dashboardConfig = {
  mode: "folder",
  tags: [] as string[],
  bookmarkSort: "recently_added",
};
export let widgetOrder: Record<string, number> = {};
export let dashboardWidgets: DashboardWidget[] = [];
export let collapsedSections: string[] = [];

// Dashboard View State
export let currentDashboardViewName: string | null = null;
export let currentDashboardViewId: string | null = null;
export let dashboardHasUnsavedChanges: boolean = false;
export let savedDashboardState: string | null = null;

// Fullscreen State
export let isFullscreen: boolean = false;

// Filter State
export let filterConfig: FilterConfig = {
  sort: "recently_added",
  tags: [],
  tagSort: "count_desc",
  tagMode: "OR",
};

// Tag metadata (colors, icons) loaded from database
export let tagMetadata: Record<string, { color?: string; icon?: string }> = {};

// Selection State
export let selectedBookmarks = new Set<string>();
export let lastSelectedIndex: number | null = null;
export let bulkMode: boolean = false;

// Command Palette State
export let commandPaletteOpen: boolean = false;
export let commandPaletteEntries: Command[] = [];
export let commandPaletteActiveIndex: number = 0;

// Tour State
export let tourState = {
  active: false,
  currentStep: 0,
  steps: [
    {
      title: "✨ Add Your First Bookmark",
      description: 'Click the "Add Bookmark" button to save your first link.',
      target: "sidebar-add-bookmark-btn",
      position: "bottom",
    },
    {
      title: "🔍 Search in Seconds",
      description: "Use Ctrl+K to search all your bookmarks instantly.",
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
  ] as TourStep[],
};

// Misc State
export let lastTagRenameAction: { from: string; to: string } | null = null;
export let isInitialLoad: boolean = true;

// Lazy Loading State
export const BOOKMARKS_PER_PAGE = 50;
export let displayedCount: number = BOOKMARKS_PER_PAGE;
export let isLoadingMore: boolean = false;
export let isLoading: boolean = false;

// Drag and Drop State
export let draggedWidget: any = null;
export let draggedSidebarItem: any = null;
export let isDraggingWidget: boolean = false;
export let dragStartPos = { x: 0, y: 0 };
export let widgetStartPos = { x: 0, y: 0 };
export let isResizing: boolean = false;
export let resizingWidget: any = null;
export let resizeStartSize = { w: 0, h: 0 };

// Sidebar Popout State
export let sidebarPopout: any = null;
export let popoutTimeout: any = null;

// Tag Suggestion State
export let tagSuggestTimeout: any = null;
export let allSidebarTags: { name: string; count: number }[] = [];
export let showingAllTags: boolean = false;

// Color Palettes
export const tabColors = [
  "blue",
  "red",
  "green",
  "gray",
  "orange",
  "purple",
  "teal",
  "pink",
  "yellow",
  "indigo",
];
export const widgetColors = [
  "blue",
  "gold",
  "orange",
  "teal",
  "gray",
  "purple",
  "red",
  "olive",
  "green",
  "navy",
  "maroon",
  "brown",
  "dark",
];

// View-specific toolbar configuration
export let viewToolbarConfig: Record<string, any> = {
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
};

// State setters
export function setAuthToken(val: string | null) {
  authToken = val;
}
export function setCsrfToken(val: string | null) {
  csrfToken = val;
}
export function setCurrentUser(val: User | null) {
  currentUser = val;
}
export function setIsAuthenticated(val: boolean) {
  isAuthenticated = val;
}
export function setBookmarks(val: Bookmark[]) {
  bookmarks = val;
}
export function setFolders(val: Folder[]) {
  folders = val;
}
export function setCollections(val: any[]) {
  collections = val;
}
export function setRenderedBookmarks(val: Bookmark[]) {
  renderedBookmarks = val;
}
export function setCurrentDashboardTab(val: string | null) {
  currentDashboardTab = val;
}
export function setCurrentView(val: string) {
  // Clean up tag cloud resize listener if leaving tag cloud view
  if (currentView === "tag-cloud" && val !== "tag-cloud") {
    if (typeof (window as any).__tagCloudResizeCleanup === "function") {
      (window as any).__tagCloudResizeCleanup();
      (window as any).__tagCloudResizeCleanup = undefined;
    }
  }
  currentView = val;
}
export function setCurrentFolder(val: string | null) {
  currentFolder = val;
}
export function setCurrentCollection(val: string | null) {
  currentCollection = val;
}
export function setViewMode(val: "grid" | "list" | "compact") {
  viewMode = val;
}
export function setTagMetadata(val: Record<string, any>) {
  tagMetadata = val;
}
export function setHideFavicons(val: boolean) {
  hideFavicons = val;
}
export function setHideSidebar(val: boolean) {
  hideSidebar = val;
}
export function setAiSuggestionsEnabled(val: boolean) {
  aiSuggestionsEnabled = val;
}
export function setIncludeChildBookmarks(val: boolean) {
  includeChildBookmarks = val;
}
export function setSnapToGrid(val: boolean) {
  snapToGrid = val;
}
export function setTourCompleted(val: boolean) {
  tourCompleted = val;
}
export function setRichLinkPreviewsEnabled(val: boolean) {
  richLinkPreviewsEnabled = val;
}
export function setTagCloudMaxTags(val: number) {
  tagCloudMaxTags = val;
}
export function setTagCloudDefaultShowAll(val: boolean) {
  tagCloudDefaultShowAll = val;
}
export function setDashboardConfig(val: any) {
  dashboardConfig = val;
}
export function setWidgetOrder(val: Record<string, number>) {
  widgetOrder = val;
}
export function setDashboardWidgets(val: DashboardWidget[]) {
  dashboardWidgets = val;
}
export function setCollapsedSections(val: string[]) {
  collapsedSections = val;
}
export function setCurrentDashboardViewName(val: string | null) {
  currentDashboardViewName = val;
}
export function setCurrentDashboardViewId(val: string | null) {
  currentDashboardViewId = val;
}
export function setDashboardHasUnsavedChanges(val: boolean) {
  dashboardHasUnsavedChanges = val;
}
export function setSavedDashboardState(val: string | null) {
  savedDashboardState = val;
}
export function setIsFullscreen(val: boolean) {
  isFullscreen = val;
}
export function setFilterConfig(val: FilterConfig) {
  filterConfig = val;
}
export function setLastSelectedIndex(val: number | null) {
  lastSelectedIndex = val;
}
export function setBulkMode(val: boolean) {
  bulkMode = val;
}
export function setCommandPaletteOpen(val: boolean) {
  commandPaletteOpen = val;
}
export function setCommandPaletteEntries(val: Command[]) {
  commandPaletteEntries = val;
}
export function setCommandPaletteActiveIndex(val: number) {
  commandPaletteActiveIndex = val;
}
export function setTourState(val: any) {
  tourState = val;
}
export function setLastTagRenameAction(
  val: { from: string; to: string } | null,
) {
  lastTagRenameAction = val;
}
export function setIsInitialLoad(val: boolean) {
  isInitialLoad = val;
}
export function setDisplayedCount(val: number) {
  displayedCount = val;
}
export function setIsLoadingMore(val: boolean) {
  isLoadingMore = val;
}
export function setIsLoading(val: boolean) {
  isLoading = val;
}
export function setDraggedWidget(val: any) {
  draggedWidget = val;
}
export function setDraggedSidebarItem(val: any) {
  draggedSidebarItem = val;
}
export function setIsDraggingWidget(val: boolean) {
  isDraggingWidget = val;
}
export function setDragStartPos(val: { x: number; y: number }) {
  dragStartPos = val;
}
export function setWidgetStartPos(val: { x: number; y: number }) {
  widgetStartPos = val;
}
export function setIsResizing(val: boolean) {
  isResizing = val;
}
export function setResizingWidget(val: any) {
  resizingWidget = val;
}
export function setResizeStartSize(val: { w: number; h: number }) {
  resizeStartSize = val;
}
export function setSidebarPopout(val: any) {
  sidebarPopout = val;
}
export function setPopoutTimeout(val: any) {
  popoutTimeout = val;
}
export function setTagSuggestTimeout(val: any) {
  tagSuggestTimeout = val;
}
export function setAllSidebarTags(val: { name: string; count: number }[]) {
  allSidebarTags = val;
}
export function setShowingAllTags(val: boolean) {
  showingAllTags = val;
}
export function setViewToolbarConfig(view: string, config: any) {
  if (viewToolbarConfig[view]) {
    viewToolbarConfig[view] = { ...viewToolbarConfig[view], ...config };
  }
}

// Migrate old localStorage keys on load
(function migrateLocalStorageKeys() {
  const oldPrefix = "anchormarks_";
  const newPrefix = "anchormarks_";
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(oldPrefix)) keysToMigrate.push(key);
  }
  keysToMigrate.forEach((oldKey) => {
    const suffix = oldKey.slice(oldPrefix.length);
    const newKey = `${newPrefix}${suffix}`;
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey) || "");
    }
    localStorage.removeItem(oldKey);
  });
})();
