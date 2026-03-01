import type { UserSettings } from "../types/index";
import { safeLocalStorage } from "../utils/index.ts";

export function applyTheme(settings: UserSettings) {
  if (settings.theme === "system") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.setAttribute("data-theme", settings.theme);
  }
}
/**
 * AnchorMarks - Global State Module
 * Manages all shared application state with reactive subscriptions
 */

type StateListener = (key: string, value: unknown) => void;

const listeners = new Set<StateListener>();

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(key: string, value: unknown): void {
  for (const listener of listeners) {
    listener(key, value);
  }
}

import {
  User,
  Bookmark,
  Folder,
  Tag,
  DashboardWidget,
  FilterConfig,
  TourStep,
  Collection,
} from "../types/index";

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
export let collections: Collection[] = [];
export let totalCount: number = 0;
export let widgetDataCache: Record<string, Bookmark[]> = {};

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

// Tag metadata (colors, icons, counts) loaded from database
export let tagMetadata: Record<
  string,
  { color?: string; icon?: string; id?: string; count?: number }
> = {};

// Selection State
export let selectedBookmarks = new Set<string>();
export let lastSelectedIndex: number | null = null;
export let bulkMode: boolean = false;

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
export let draggedWidget: HTMLElement | null = null;
export let draggedSidebarItem: Folder | Tag | null = null;
export let isDraggingWidget: boolean = false;
export let dragStartPos = { x: 0, y: 0 };
export let widgetStartPos = { x: 0, y: 0 };
export let isResizing: boolean = false;
export let resizingWidget: HTMLElement | null = null;
export let resizeStartSize = { w: 0, h: 0 };

// Sidebar Popout State
export let sidebarPopout: HTMLElement | null = null;
export let popoutTimeout: ReturnType<typeof setTimeout> | null = null;

// Tag Suggestion State
export let tagSuggestTimeout: ReturnType<typeof setTimeout> | null = null;
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
  analytics: {
    title: "Analytics",
    showViewToggle: false,
    showSearch: false,
    showAddButton: false,
    customActions: [],
  },
};

// State setters
export function setAuthToken(val: string | null) {
  authToken = val;
  emit("authToken", val);
}
export function setCsrfToken(val: string | null) {
  csrfToken = val;
  emit("csrfToken", val);
}
export function setCurrentUser(val: User | null) {
  currentUser = val;
  emit("currentUser", val);
}
export function setIsAuthenticated(val: boolean) {
  isAuthenticated = val;
  emit("isAuthenticated", val);
}
export function setBookmarks(val: Bookmark[]) {
  bookmarks = val;
  emit("bookmarks", val);
}
export function setFolders(val: Folder[]) {
  folders = val;
  emit("folders", val);
}
export function setCollections(val: Collection[]) {
  collections = val;
  emit("collections", val);
}
export function setRenderedBookmarks(val: Bookmark[]) {
  renderedBookmarks = val;
  emit("renderedBookmarks", val);
}
export function setTotalCount(val: number) {
  totalCount = val;
  emit("totalCount", val);
}
export function setWidgetDataCache(id: string, val: Bookmark[]) {
  widgetDataCache[id] = val;
  emit("widgetDataCache", { id, val });
}
export function clearWidgetDataCache() {
  widgetDataCache = {};
  emit("widgetDataCache", null);
}
export function resetPagination() {
  displayedCount = BOOKMARKS_PER_PAGE;
  totalCount = 0;
  emit("displayedCount", BOOKMARKS_PER_PAGE);
  emit("totalCount", 0);
}
export function setCurrentDashboardTab(val: string | null) {
  currentDashboardTab = val;
  emit("currentDashboardTab", val);
}
export async function setCurrentView(val: string) {
  const prevView = currentView;

  // Clean up previous view's event listeners before changing state
  if (prevView && prevView !== val) {
    const { cleanupView } = await import("../utils/event-cleanup.ts");
    cleanupView(prevView);
  }

  // Clean up tag cloud resize listener if leaving tag cloud view
  if (prevView === "tag-cloud" && val !== "tag-cloud") {
    if (typeof window.__tagCloudResizeCleanup === "function") {
      window.__tagCloudResizeCleanup();
      window.__tagCloudResizeCleanup = undefined;
    }
  }

  // Clear filters and search inputs before updating view so no handler sees new view + old input
  if (val === "favorites" || val === "recent" || val === "most-used") {
    setFilterConfig({
      ...filterConfig,
      tags: [],
      search: undefined,
    });
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    if (searchInput) searchInput.value = "";
    const filterSearchInput = document.getElementById(
      "filter-search-input",
    ) as HTMLInputElement;
    if (filterSearchInput) filterSearchInput.value = "";
  }

  // Only update view after cleanup and DOM/state prep so state stays consistent
  currentView = val;
  emit("currentView", val);

  // Body classes for view-specific layout overrides
  document.body.classList.toggle("dashboard-active", val === "dashboard");
  document.body.classList.toggle("tag-cloud-active", val === "tag-cloud");
  document.body.classList.toggle("analytics-active", val === "analytics");
}
export function setCurrentFolder(val: string | null) {
  currentFolder = val;
  emit("currentFolder", val);
}
export function setCurrentCollection(val: string | null) {
  currentCollection = val;
  emit("currentCollection", val);
}
export function setViewMode(val: "grid" | "list" | "compact") {
  viewMode = val;
  emit("viewMode", val);
}
export function setTagMetadata(val: Record<string, any>) {
  tagMetadata = val;
  emit("tagMetadata", val);
}
export function setHideFavicons(val: boolean) {
  hideFavicons = val;
  emit("hideFavicons", val);
}
export function setHideSidebar(val: boolean) {
  hideSidebar = val;
  emit("hideSidebar", val);
}
export function setAiSuggestionsEnabled(val: boolean) {
  aiSuggestionsEnabled = val;
  emit("aiSuggestionsEnabled", val);
}
export function setIncludeChildBookmarks(val: boolean) {
  if (includeChildBookmarks !== val) {
    widgetDataCache = {};
    emit("widgetDataCache", null);
  }
  includeChildBookmarks = val;
  emit("includeChildBookmarks", val);
}
export function setSnapToGrid(val: boolean) {
  snapToGrid = val;
  emit("snapToGrid", val);
}
export function setTourCompleted(val: boolean) {
  tourCompleted = val;
  emit("tourCompleted", val);
}
export function setRichLinkPreviewsEnabled(val: boolean) {
  richLinkPreviewsEnabled = val;
  emit("richLinkPreviewsEnabled", val);
}
export function setTagCloudMaxTags(val: number) {
  tagCloudMaxTags = val;
  emit("tagCloudMaxTags", val);
}
export function setTagCloudDefaultShowAll(val: boolean) {
  tagCloudDefaultShowAll = val;
  emit("tagCloudDefaultShowAll", val);
}
export function setDashboardConfig(val: typeof dashboardConfig) {
  dashboardConfig = val;
  emit("dashboardConfig", val);
}
export function setWidgetOrder(val: Record<string, number>) {
  widgetOrder = val;
  emit("widgetOrder", val);
}
export function setDashboardWidgets(val: DashboardWidget[]) {
  dashboardWidgets = val;
  emit("dashboardWidgets", val);
}
export function setCollapsedSections(val: string[]) {
  collapsedSections = val;
  emit("collapsedSections", val);
}
export function setCurrentDashboardViewName(val: string | null) {
  currentDashboardViewName = val;
  emit("currentDashboardViewName", val);
}
export function setCurrentDashboardViewId(val: string | null) {
  currentDashboardViewId = val;
  emit("currentDashboardViewId", val);
}
export function setDashboardHasUnsavedChanges(val: boolean) {
  dashboardHasUnsavedChanges = val;
  emit("dashboardHasUnsavedChanges", val);
}
export function setSavedDashboardState(val: string | null) {
  savedDashboardState = val;
  emit("savedDashboardState", val);
}
export function setIsFullscreen(val: boolean) {
  isFullscreen = val;
  emit("isFullscreen", val);
}
export function setFilterConfig(val: FilterConfig) {
  filterConfig = val;
  emit("filterConfig", val);
}
export function setLastSelectedIndex(val: number | null) {
  lastSelectedIndex = val;
  emit("lastSelectedIndex", val);
}
export function setBulkMode(val: boolean) {
  bulkMode = val;
  emit("bulkMode", val);
}
export function setTourState(val: {
  active: boolean;
  currentStep: number;
  steps: TourStep[];
}) {
  tourState = val;
  emit("tourState", val);
}
export function setLastTagRenameAction(
  val: { from: string; to: string } | null,
) {
  lastTagRenameAction = val;
  emit("lastTagRenameAction", val);
}
export function setIsInitialLoad(val: boolean) {
  isInitialLoad = val;
  emit("isInitialLoad", val);
}
export function setDisplayedCount(val: number) {
  displayedCount = val;
  emit("displayedCount", val);
}
export function setIsLoadingMore(val: boolean) {
  isLoadingMore = val;
  emit("isLoadingMore", val);
}
export function setIsLoading(val: boolean) {
  isLoading = val;
  emit("isLoading", val);
}
export function setDraggedWidget(val: HTMLElement | null) {
  draggedWidget = val;
  emit("draggedWidget", val);
}
export function setDraggedSidebarItem(val: Folder | Tag | null) {
  draggedSidebarItem = val;
  emit("draggedSidebarItem", val);
}
export function setIsDraggingWidget(val: boolean) {
  isDraggingWidget = val;
  emit("isDraggingWidget", val);
}
export function setDragStartPos(val: { x: number; y: number }) {
  dragStartPos = val;
  emit("dragStartPos", val);
}
export function setWidgetStartPos(val: { x: number; y: number }) {
  widgetStartPos = val;
  emit("widgetStartPos", val);
}
export function setIsResizing(val: boolean) {
  isResizing = val;
  emit("isResizing", val);
}
export function setResizingWidget(val: HTMLElement | null) {
  resizingWidget = val;
  emit("resizingWidget", val);
}
export function setResizeStartSize(val: { w: number; h: number }) {
  resizeStartSize = val;
  emit("resizeStartSize", val);
}
export function setSidebarPopout(val: HTMLElement | null) {
  sidebarPopout = val;
  emit("sidebarPopout", val);
}
export function setPopoutTimeout(val: ReturnType<typeof setTimeout> | null) {
  popoutTimeout = val;
  emit("popoutTimeout", val);
}
export function setTagSuggestTimeout(
  val: ReturnType<typeof setTimeout> | null,
) {
  tagSuggestTimeout = val;
  emit("tagSuggestTimeout", val);
}
export function setAllSidebarTags(val: { name: string; count: number }[]) {
  allSidebarTags = val;
  emit("allSidebarTags", val);
}
export function setShowingAllTags(val: boolean) {
  showingAllTags = val;
  emit("showingAllTags", val);
}
export function setViewToolbarConfig(
  view: string,
  config: Record<string, unknown>,
) {
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
    const oldValue = safeLocalStorage.getItem(oldKey);
    const existingValue = safeLocalStorage.getItem(newKey);
    if (!existingValue && oldValue) {
      safeLocalStorage.setItem(newKey, oldValue);
    }
    safeLocalStorage.removeItem(oldKey);
  });
})();
