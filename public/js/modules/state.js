/**
 * AnchorMarks - Global State Module
 * Manages all shared application state
 */

// API Configuration
export const API_BASE = '/api';

// Authentication State
export let authToken = null;
export let csrfToken = null;
export let currentUser = null;
export let isAuthenticated = false;

// Data State
export let bookmarks = [];
export let folders = [];
export let renderedBookmarks = [];

// UI State
export let currentDashboardTab = null;
export let currentView = 'dashboard';
export let currentFolder = null;
export let viewMode = 'grid';
export let hideFavicons = false;
export let hideSidebar = false;
export let includeChildBookmarks = false;
export let snapToGrid = true;

// Dashboard State
export let dashboardConfig = { mode: 'folder', tags: [], bookmarkSort: 'recently_added' };
export let widgetOrder = {};
export let dashboardWidgets = [];
export let collapsedSections = [];

// Filter State
export let filterConfig = { sort: 'recently_added', tags: [], tagSort: 'count_desc', tagMode: 'OR' };

// Selection State
export let selectedBookmarks = new Set();
export let lastSelectedIndex = null;
export let bulkMode = false;

// Command Palette State
export let commandPaletteOpen = false;
export let commandPaletteEntries = [];
export let commandPaletteActiveIndex = 0;

// Tour State
export let tourState = {
    active: false,
    currentStep: 0,
    steps: [
        {
            title: '✨ Add Your First Bookmark',
            description: 'Click the "Add Bookmark" button to save your first link.',
            target: 'sidebar-add-bookmark-btn',
            position: 'bottom'
        },
        {
            title: '🔍 Search in Seconds',
            description: 'Use Ctrl+K to search all your bookmarks instantly.',
            target: 'search-input',
            position: 'bottom'
        },
        {
            title: '🏷️ Organize with Tags',
            description: 'Add tags to bookmarks for flexible filtering and organization.',
            target: 'bookmark-tags',
            position: 'bottom'
        }
    ]
};

// Misc State
export let lastTagRenameAction = null;
export let isInitialLoad = true;

// Lazy Loading State
export const BOOKMARKS_PER_PAGE = 50;
export let displayedCount = BOOKMARKS_PER_PAGE;
export let isLoadingMore = false;

// Drag and Drop State
export let draggedWidget = null;
export let draggedSidebarItem = null;
export let isDraggingWidget = false;
export let dragStartPos = { x: 0, y: 0 };
export let widgetStartPos = { x: 0, y: 0 };
export let isResizing = false;
export let resizingWidget = null;
export let resizeStartSize = { w: 0, h: 0 };

// Sidebar Popout State
export let sidebarPopout = null;
export let popoutTimeout = null;

// Tag Suggestion State
export let tagSuggestTimeout = null;
export let allSidebarTags = [];
export let showingAllTags = false;

// Color Palettes
export const tabColors = ['blue', 'red', 'green', 'gray', 'orange', 'purple', 'teal', 'pink', 'yellow', 'indigo'];
export const widgetColors = ['blue', 'gold', 'orange', 'teal', 'gray', 'purple', 'red', 'olive', 'green', 'navy', 'maroon', 'brown', 'dark'];

// View-specific toolbar configuration
export let viewToolbarConfig = {
    dashboard: {
        title: 'Dashboard',
        showViewToggle: false,
        showSearch: false,
        showAddButton: true,
        customActions: ['layout', 'widgets', 'settings']
    },
    all: {
        title: 'Bookmarks',
        showViewToggle: true,
        showSearch: true,
        showFilters: true,
        customActions: ['bulk-select']
    },
    favorites: {
        title: 'Favorites',
        showViewToggle: true,
        showSearch: true,
        showSort: true,
        customActions: []
    },
    recent: {
        title: 'Recent',
        showViewToggle: true,
        showSearch: true,
        showTimeRange: true,
        customActions: []
    }
};


// State setters (needed because ES modules use live bindings but can't reassign imports)
export function setAuthToken(val) { authToken = val; }
export function setCsrfToken(val) { csrfToken = val; }
export function setCurrentUser(val) { currentUser = val; }
export function setIsAuthenticated(val) { isAuthenticated = val; }
export function setBookmarks(val) { bookmarks = val; }
export function setFolders(val) { folders = val; }
export function setRenderedBookmarks(val) { renderedBookmarks = val; }
export function setCurrentDashboardTab(val) { currentDashboardTab = val; }
export function setCurrentView(val) { currentView = val; }
export function setCurrentFolder(val) { currentFolder = val; }
export function setViewMode(val) { viewMode = val; }
export function setHideFavicons(val) { hideFavicons = val; }
export function setHideSidebar(val) { hideSidebar = val; }
export function setIncludeChildBookmarks(val) { includeChildBookmarks = val; }
export function setSnapToGrid(val) { snapToGrid = val; }
export function setDashboardConfig(val) { dashboardConfig = val; }
export function setWidgetOrder(val) { widgetOrder = val; }
export function setDashboardWidgets(val) { dashboardWidgets = val; }
export function setCollapsedSections(val) { collapsedSections = val; }
export function setFilterConfig(val) { filterConfig = val; }
export function setLastSelectedIndex(val) { lastSelectedIndex = val; }
export function setBulkMode(val) { bulkMode = val; }
export function setCommandPaletteOpen(val) { commandPaletteOpen = val; }
export function setCommandPaletteEntries(val) { commandPaletteEntries = val; }
export function setCommandPaletteActiveIndex(val) { commandPaletteActiveIndex = val; }
export function setTourState(val) { tourState = val; }
export function setLastTagRenameAction(val) { lastTagRenameAction = val; }
export function setIsInitialLoad(val) { isInitialLoad = val; }
export function setDisplayedCount(val) { displayedCount = val; }
export function setIsLoadingMore(val) { isLoadingMore = val; }
export function setDraggedWidget(val) { draggedWidget = val; }
export function setDraggedSidebarItem(val) { draggedSidebarItem = val; }
export function setIsDraggingWidget(val) { isDraggingWidget = val; }
export function setDragStartPos(val) { dragStartPos = val; }
export function setWidgetStartPos(val) { widgetStartPos = val; }
export function setIsResizing(val) { isResizing = val; }
export function setResizingWidget(val) { resizingWidget = val; }
export function setResizeStartSize(val) { resizeStartSize = val; }
export function setSidebarPopout(val) { sidebarPopout = val; }
export function setPopoutTimeout(val) { popoutTimeout = val; }
export function setTagSuggestTimeout(val) { tagSuggestTimeout = val; }
export function setAllSidebarTags(val) { allSidebarTags = val; }
export function setShowingAllTags(val) { showingAllTags = val; }
export function setViewToolbarConfig(view, config) {
    if (viewToolbarConfig[view]) {
        viewToolbarConfig[view] = { ...viewToolbarConfig[view], ...config };
    }
}


// Migrate old localStorage keys on load
(function migrateLocalStorageKeys() {
    const oldPrefix = 'anchormarks_';
    const newPrefix = 'anchormarks_';
    const keysToMigrate = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(oldPrefix)) keysToMigrate.push(key);
    }
    keysToMigrate.forEach(oldKey => {
        const suffix = oldKey.slice(oldPrefix.length);
        const newKey = `${newPrefix}${suffix}`;
        if (!localStorage.getItem(newKey)) {
            localStorage.setItem(newKey, localStorage.getItem(oldKey));
        }
        localStorage.removeItem(oldKey);
    });
})();
