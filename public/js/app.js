// AnchorMarks - Frontend Application

function migrateLocalStorageKeys() {
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
}

migrateLocalStorageKeys();

const API_BASE = '/api';
let authToken = null; // No longer using localStorage
let csrfToken = null; // Will be set from server
let currentUser = null;
let bookmarks = [];
let folders = [];
let renderedBookmarks = [];
let currentDashboardTab = null;
let currentView = 'dashboard';
let currentFolder = null;
let viewMode = 'grid'; // Will be loaded from database
let hideFavicons = false; // Will be loaded from database
let hideSidebar = false; // Will be loaded from database
let dashboardConfig = { mode: 'folder', tags: [], bookmarkSort: 'recently_added' }; // Will be loaded from database
let widgetOrder = {}; // Will be loaded from database
let dashboardWidgets = []; // Freeform positioned widgets with {id, type, x, y, w, h}
let collapsedSections = []; // Will be loaded from database
let filterConfig = { sort: 'recently_added', tags: [], tagSort: 'count_desc', tagMode: 'OR' };
let selectedBookmarks = new Set();
let lastSelectedIndex = null;
let bulkMode = false;
let commandPaletteOpen = false;
let commandPaletteEntries = [];
let commandPaletteActiveIndex = 0;
let lastTagRenameAction = null;
let isInitialLoad = true;

// Lazy loading state
const BOOKMARKS_PER_PAGE = 50;
let displayedCount = BOOKMARKS_PER_PAGE;
let isLoadingMore = false;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authTabs = document.querySelectorAll('.auth-tab');
const bookmarksContainer = document.getElementById('bookmarks-container');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const viewTitle = document.getElementById('view-title');
const viewCount = document.getElementById('view-count');
const bulkBar = document.getElementById('bulk-bar');
const bulkMoveSelect = document.getElementById('bulk-move-select');
const bulkCount = document.getElementById('bulk-count');
const commandPalette = document.getElementById('command-palette');
const commandPaletteInput = document.getElementById('command-palette-input');
const commandPaletteList = document.getElementById('command-palette-list');
const bookmarkUrlInput = document.getElementById('bookmark-url');
const bookmarkTagsInput = document.getElementById('bookmark-tags');
const tagSuggestions = document.getElementById('tag-suggestions');
const tagStatsList = document.getElementById('tag-stats-list');
const tagRenameFrom = document.getElementById('tag-rename-from');
const tagRenameTo = document.getElementById('tag-rename-to');
const tagRenameBtn = document.getElementById('tag-rename-btn');
const tagRenameUndoBtn = document.getElementById('tag-rename-undo-btn');

// API Helper
async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include', // Include cookies in request
        headers: { ...headers, ...options.headers }
    });

    if (response.status === 401) {
        logout();
        throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API Error');
    return data;
}

// Auth Functions
async function login(email, password) {
    try {
        console.log('Attempting login for:', email);
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        csrfToken = data.csrfToken;
        currentUser = data.user;
        showMainApp();
        showToast('Welcome back!', 'success');
    } catch (err) {
        console.error('Login failed:', err.message);
        showToast(err.message, 'error');
    }
}

async function register(email, password) {
    try {
        const data = await api('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        csrfToken = data.csrfToken;
        currentUser = data.user;
        showMainApp();
        showToast('Account created successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    // Call logout API first (needs csrfToken), then clear state
    api('/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => {
        csrfToken = null;
        currentUser = null;
        showAuthScreen();
    });
}

async function checkAuth() {
    try {
        const data = await api('/auth/me');
        currentUser = data.user;
        csrfToken = data.csrfToken;
        await loadSettings(); // Load user settings from database
        showMainApp();
    } catch (err) {
        // If token verification fails, show login
        console.error('Auth check failed:', err.message);
        csrfToken = null;
        currentUser = null;
        showAuthScreen();
    }
}

// Settings API
async function loadSettings() {
    try {
        const settings = await api('/settings');
        viewMode = settings.view_mode || 'grid';
        hideFavicons = settings.hide_favicons || false;
        hideSidebar = settings.hide_sidebar || false;
        dashboardConfig = {
            mode: settings.dashboard_mode || 'folder',
            tags: settings.dashboard_tags || [],
            bookmarkSort: settings.dashboard_sort || 'recently_added'
        };
        widgetOrder = settings.widget_order || {};
        dashboardWidgets = settings.dashboard_widgets || [];
        collapsedSections = settings.collapsed_sections || [];
        
        // Apply theme
        document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = settings.theme === 'dark';
        
        // Apply sidebar collapsed state from localStorage (UI preference)
        const sidebarCollapsed = localStorage.getItem('anchormarks_sidebar_collapsed') === 'true';
        if (sidebarCollapsed) {
            document.body.classList.add('sidebar-collapsed');
            // Initialize popouts after a short delay to ensure DOM is ready
            setTimeout(() => initSidebarPopouts(), 100);
        }
        
        // Apply collapsed sections
        collapsedSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.classList.add('collapsed');
        });
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

async function saveSettings(updates) {
    try {
        await api('/settings', {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
}

// UI State
function showAuthScreen() {
    closeModals(); // Close any open modals (settings, etc.)
    authScreen.classList.remove('hidden');
    mainApp.classList.add('hidden');
}

function showMainApp() {
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    initializeApp();
}

async function initializeApp() {
    updateUserInfo();
    await Promise.all([loadFolders(), loadBookmarks()]);
    applyTheme();
    setViewMode(viewMode);
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.email;
        document.getElementById('user-avatar').textContent = currentUser.email.charAt(0).toUpperCase();
        document.getElementById('api-key-value').textContent = currentUser.api_key;
    }
}

// Bookmarks
async function loadBookmarks() {
    try {
        let endpoint = '/bookmarks';
        const params = new URLSearchParams();

        if (currentView === 'favorites') params.append('favorites', 'true');
        if (currentFolder) params.append('folder_id', currentFolder);
        
        // Add sort parameter from filter config or dashboard config
        const sortOption = filterConfig.sort || dashboardConfig.bookmarkSort || 'recently_added';
        params.append('sort', sortOption);

        const query = params.toString();
        if (query) endpoint += `?${query}`;

        bookmarks = await api(endpoint);

        if (currentView === 'dashboard') {
            renderDashboard();
        } else {
            renderBookmarks();
        }
        updateCounts();
        renderSidebarTags();

        // Check if we should show welcome tour
        checkWelcomeTour();
    } catch (err) {
        showToast('Failed to load bookmarks', 'error');
    }
}

// Onboarding Tour
let tourState = {
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

function checkWelcomeTour() {
    // Only show on initial app load, not on filter changes
    if (!isInitialLoad) return;
    
    const dismissed = localStorage.getItem('anchormarks_tour_dismissed');
    if (dismissed) return;

    // Show tour for new users (fewer than 20 bookmarks)
    if (bookmarks.length < 20) {
        setTimeout(() => {
            startTour();
        }, 800);
    }
    
    // Mark that we've done the initial check
    isInitialLoad = false;
}

function startTour() {
    if (tourState.active) return;
    tourState.active = true;
    tourState.currentStep = 0;
    showTourStep();
}

function showTourStep() {
    const step = tourState.steps[tourState.currentStep];
    if (!step) return;

    const overlay = document.getElementById('tour-overlay');
    const popover = document.getElementById('tour-popover');
    const titleEl = document.getElementById('tour-title');
    const descEl = document.getElementById('tour-description');
    const nextBtn = document.getElementById('tour-next-btn');

    // Update content
    titleEl.textContent = step.title;
    descEl.textContent = step.description;

    // Update step indicators
    document.querySelectorAll('.tour-step').forEach((el, i) => {
        el.classList.toggle('active', i === tourState.currentStep);
    });

    // Update button text
    const isLastStep = tourState.currentStep === tourState.steps.length - 1;
    nextBtn.textContent = isLastStep ? 'Got it!' : 'Next';

    // Position popover near target element
    const targetEl = document.getElementById(step.target);
    if (targetEl) {
        positionPopover(popover, targetEl, step.position);
        // Highlight target
        targetEl.classList.add('tour-highlight');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Show overlay and popover
    overlay.classList.remove('hidden');
    popover.classList.remove('hidden');
}

function positionPopover(popover, target, position) {
    const rect = target.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 16;
    let top, left;

    // Calculate position
    if (position === 'bottom') {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - popoverRect.width / 2;
    } else if (position === 'top') {
        top = rect.top - popoverRect.height - gap;
        left = rect.left + rect.width / 2 - popoverRect.width / 2;
    } else if (position === 'right') {
        top = rect.top + rect.height / 2 - popoverRect.height / 2;
        left = rect.right + gap;
    } else {
        top = rect.top + rect.height / 2 - popoverRect.height / 2;
        left = rect.left - popoverRect.width - gap;
    }

    // Keep within viewport
    const minPadding = 16;
    left = Math.max(minPadding, Math.min(left, window.innerWidth - popoverRect.width - minPadding));
    top = Math.max(minPadding, Math.min(top, window.innerHeight - popoverRect.height - minPadding));

    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
}

function nextTourStep() {
    // Remove highlight from current target
    const currentStep = tourState.steps[tourState.currentStep];
    const targetEl = document.getElementById(currentStep.target);
    if (targetEl) {
        targetEl.classList.remove('tour-highlight');
    }

    tourState.currentStep++;
    
    if (tourState.currentStep >= tourState.steps.length) {
        endTour();
    } else {
        showTourStep();
    }
}

function endTour() {
    const overlay = document.getElementById('tour-overlay');
    const popover = document.getElementById('tour-popover');

    // Remove highlight
    document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
    });

    // Hide elements
    overlay.classList.add('hidden');
    popover.classList.add('hidden');

    tourState.active = false;
    localStorage.setItem('anchormarks_tour_dismissed', 'true');
    showToast('🎉 Tour complete! Happy bookmarking!');
}

function skipTour() {
    const overlay = document.getElementById('tour-overlay');
    const popover = document.getElementById('tour-popover');

    // Remove highlight
    document.querySelectorAll('.tour-highlight').forEach(el => {
        el.classList.remove('tour-highlight');
    });

    // Hide elements
    overlay.classList.add('hidden');
    popover.classList.add('hidden');

    tourState.active = false;
    localStorage.setItem('anchormarks_tour_dismissed', 'true');
}

function filterByTag(tag) {
    searchInput.value = tag;
    currentFolder = null;
    currentView = 'all'; // Keep 'all' view but filtered
    viewTitle.textContent = `Tag: ${tag}`;
    updateActiveNav();
    renderBookmarks();
}

// Get contextual empty state message
function getEmptyStateMessage() {
    if (currentView === 'favorites') {
        return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--primary-400);margin-bottom:1rem">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3>No favorites yet</h3>
                <p>Click the star icon on any bookmark<br>to add it to your favorites.</p>
            </div>
        `;
    }

    if (filterConfig.tags.length > 0) {
        return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                <h3>No bookmarks with these tags</h3>
                <p>No bookmarks match your selected tags.<br><button class="btn-link" data-action="clear-filters">Clear filters</button></p>
            </div>
        `;
    }

    if (searchInput.value.trim()) {
        return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <h3>No results found</h3>
                <p>No bookmarks match "${escapeHtml(searchInput.value)}".<br>Try a different search term.</p>
            </div>
        `;
    }

    if (currentView === 'folder' && currentFolder) {
        return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <h3>This folder is empty</h3>
                <p>Add bookmarks to this folder by clicking<br>"Add Bookmark" and selecting it.</p>
            </div>
        `;
    }

    return `
        <div class="empty-state-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--primary-400);margin-bottom:1rem">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <h3>No bookmarks yet</h3>
            <p>Click "Add Bookmark" to save your first link,<br>or import bookmarks from your browser.</p>
            <button class="btn btn-primary" data-action="open-modal" data-modal-target="bookmark-modal" style="margin-top:1rem">Add Your First Bookmark</button>
        </div>
    `;
}

// Color palette for tabs and widgets
const tabColors = ['blue', 'red', 'green', 'gray', 'orange', 'purple', 'teal', 'pink', 'yellow', 'indigo'];
const widgetColors = ['blue', 'gold', 'orange', 'teal', 'gray', 'purple', 'red', 'olive', 'green', 'navy', 'maroon', 'brown', 'dark'];

// Sorting Helper
function sortBookmarks(list) {
    const sort = dashboardConfig.bookmarkSort || 'recently_added';
    return [...list].sort((a, b) => {
        switch (sort) {
            case 'a_z':
            case 'a-z':
            case 'alpha':
                return a.title.localeCompare(b.title);
            case 'z_a':
            case 'z-a':
                return b.title.localeCompare(a.title);
            case 'most_visited':
                return (b.click_count || 0) - (a.click_count || 0);
            case 'oldest_first':
            case 'created_asc':
            case 'updated_asc':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'recently_added':
            case 'created_desc':
            case 'updated_desc':
            default:
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });
}

function renderDashboard() {
    // Hide view toggle in dashboard
    document.querySelector('.view-toggle').classList.add('hidden');
    bulkBar?.classList.add('hidden');

    // Clear container
    bookmarksContainer.className = 'dashboard-freeform';
    bookmarksContainer.innerHTML = '';
    emptyState.classList.add('hidden');

    // Create dashboard container with drop zone
    const dashboardHtml = `
        <div class="dashboard-freeform-container" id="dashboard-drop-zone">
            <div class="dashboard-help-text">
                ${dashboardWidgets.length === 0 ? 
                    '<p>Drag folders or tags from the sidebar to create widgets</p>' : 
                    ''}
            </div>
            <div class="dashboard-widgets-container" id="dashboard-widgets-freeform">
                ${renderFreeformWidgets()}
            </div>
        </div>
    `;

    bookmarksContainer.innerHTML = dashboardHtml;
    initDashboardDragDrop();
}

function renderFreeformWidgets() {
    let html = '';
    
    dashboardWidgets.forEach((widget, index) => {
        const widgetData = getWidgetData(widget);
        if (!widgetData) return;

        const { name, color, bookmarks: widgetBookmarks, count } = widgetData;
        const sortedBookmarks = sortBookmarks(widgetBookmarks);
        const widgetColor = widget.color || color; // Use custom color if set, otherwise default

        html += `
        <div class="dashboard-widget-freeform" 
             data-widget-index="${index}"
             data-widget-id="${widget.id}"
             data-widget-type="${widget.type}"
             draggable="true"
             style="left: ${widget.x || 0}px; top: ${widget.y || 0}px; width: ${widget.w || 320}px; height: ${widget.h || 400}px;">
            <div class="widget-header" data-color="${widgetColor}">
                <div class="widget-drag-handle" title="Drag to move">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                </div>
                <div class="widget-title">${escapeHtml(name)}</div>
                <div class="widget-count">${count}</div>
                <div class="widget-actions">
                    <button class="btn-icon widget-color-btn" data-action="change-widget-color" data-index="${index}" title="Change color">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a10 10 0 0 0 0 20"/>
                        </svg>
                    </button>
                    <button class="btn-icon widget-remove" data-action="remove-widget" data-index="${index}" title="Remove widget">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="widget-body">
                <div class="compact-list">
                    ${sortedBookmarks.slice(0, 50).map(b => `
                        <a href="${b.url}" target="_blank" class="compact-item" data-action="track-click" data-id="${b.id}">
                            <div class="compact-favicon">
                                ${!hideFavicons && b.favicon ? `<img src="${b.favicon}" alt="">` :
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/></svg>`}
                            </div>
                            <span class="compact-text">${escapeHtml(b.title)}</span>
                        </a>
                    `).join('')}
                    ${sortedBookmarks.length > 50 ? `<div style="padding:0.5rem;font-size:0.75rem;color:var(--text-tertiary);text-align:center">+${sortedBookmarks.length - 50} more</div>` : ''}
                </div>
            </div>
            <div class="widget-resize-handle" title="Drag to resize"></div>
        </div>
        `;
    });

    return html;
}

function getWidgetData(widget) {
    if (widget.type === 'folder') {
        const folder = folders.find(f => f.id === widget.id);
        if (!folder) return null;
        
        const folderBookmarks = bookmarks.filter(b => b.folder_id === folder.id);
        return {
            name: folder.name,
            color: folder.color || '#6366f1',
            bookmarks: folderBookmarks,
            count: folderBookmarks.length
        };
    } else if (widget.type === 'tag') {
        const tagBookmarks = bookmarks.filter(b => 
            b.tags && b.tags.split(',').map(t => t.trim()).includes(widget.id)
        );
        return {
            name: widget.id,
            color: '#10b981',
            bookmarks: tagBookmarks,
            count: tagBookmarks.length
        };
    }
    return null;
}

function renderNestedWidgetContent(folderId) {
    let html = '';

    // 1. Direct Bookmarks
    let folderBookmarks = bookmarks.filter(b => b.folder_id === folderId);
    folderBookmarks = sortBookmarks(folderBookmarks);

    if (folderBookmarks.length > 0) {
        html += '<div class="compact-list">';
        html += folderBookmarks.slice(0, 50).map(b => `
            <a href="${b.url}" target="_blank" class="compact-item" data-action="track-click" data-id="${b.id}">
                <div class="compact-favicon">
                    ${!hideFavicons && b.favicon ? `<img src="${b.favicon}" alt="">` :
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/></svg>`}
                </div>
                <span class="compact-text">${escapeHtml(b.title)}</span>
            </a>
        `).join('');
        if (folderBookmarks.length > 50) {
            html += `<div style="padding:0.5rem;font-size:0.75rem;color:var(--text-tertiary);text-align:center">+${folderBookmarks.length - 50} more</div>`;
        }
        html += '</div>';
    }

    // 2. Subfolders
    const subFolders = folders.filter(f => f.parent_id === folderId)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (subFolders.length > 0) {
        subFolders.forEach(sub => {
            html += `<div class="subfolder-widget-section" style="margin-top:0.5rem; margin-left:0.5rem; padding-left:0.5rem; border-left: 2px solid var(--border-color);">`;
            html += `<div style="font-size:0.8rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.25rem; display:flex; align-items:center; gap:4px;">
                        <span style="width:6px;height:6px;border-radius:50%;background:${sub.color}"></span>
                        ${escapeHtml(sub.name)}
                     </div>`;
            html += renderNestedWidgetContent(sub.id);
            html += `</div>`;
        });
    }

    return html || '<div style="padding:0.5rem;font-size:0.75rem;color:var(--text-tertiary)">Empty</div>';
}

function countBookmarksInTree(folderId) {
    let count = bookmarks.filter(b => b.folder_id === folderId).length;
    folders.filter(f => f.parent_id === folderId).forEach(sub => {
        count += countBookmarksInTree(sub.id);
    });
    return count;
}

function createDashboardWidget(folder, widgetBookmarks, index) {
    // Deprecated placeholder to avoid errors if referenced elsewhere
    return '';
}

// Dashboard Drag and Drop
let draggedWidget = null;
let draggedSidebarItem = null;
let isDraggingWidget = false;
let dragStartPos = { x: 0, y: 0 };
let widgetStartPos = { x: 0, y: 0 };
let isResizing = false;
let resizingWidget = null;
let resizeStartSize = { w: 0, h: 0 };

function initDashboardDragDrop() {
    const dropZone = document.getElementById('dashboard-drop-zone');
    if (!dropZone) return;

    // Handle drops from sidebar
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        if (e.target === dropZone) {
            dropZone.classList.remove('drag-over');
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        // Get drop position relative to dashboard
        const rect = dropZone.getBoundingClientRect();
        const x = e.clientX - rect.left + dropZone.scrollLeft;
        const y = e.clientY - rect.top + dropZone.scrollTop;

        // Check if dropping from sidebar
        if (draggedSidebarItem) {
            const { type, id, name, color } = draggedSidebarItem;
            addDashboardWidget(type, id, x, y);
            draggedSidebarItem = null;
        }
    });

    // Setup widget drag and resize
    document.querySelectorAll('.dashboard-widget-freeform').forEach(widget => {
        const header = widget.querySelector('.widget-header');
        const resizeHandle = widget.querySelector('.widget-resize-handle');

        // Drag to move
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.widget-remove')) return;
            
            isDraggingWidget = true;
            draggedWidget = widget;
            dragStartPos = { x: e.clientX, y: e.clientY };
            widgetStartPos = {
                x: parseInt(widget.style.left) || 0,
                y: parseInt(widget.style.top) || 0
            };
            widget.classList.add('dragging');
            e.preventDefault();
        });

        // Resize handle
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizingWidget = widget;
                dragStartPos = { x: e.clientX, y: e.clientY };
                resizeStartSize = {
                    w: parseInt(widget.style.width) || 320,
                    h: parseInt(widget.style.height) || 400
                };
                widget.classList.add('resizing');
                e.preventDefault();
                e.stopPropagation();
            });
        }
    });

    // Global mouse move and up handlers
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Setup remove widget buttons
    document.querySelectorAll('[data-action="remove-widget"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeDashboardWidget(index);
        });
    });

    // Setup color change buttons
    document.querySelectorAll('[data-action="change-widget-color"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            showWidgetColorPicker(index, btn);
        });
    });
}

function handleMouseMove(e) {
    if (isDraggingWidget && draggedWidget) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        
        draggedWidget.style.left = `${widgetStartPos.x + deltaX}px`;
        draggedWidget.style.top = `${widgetStartPos.y + deltaY}px`;
    } else if (isResizing && resizingWidget) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        
        const newWidth = Math.max(250, resizeStartSize.w + deltaX);
        const newHeight = Math.max(200, resizeStartSize.h + deltaY);
        
        resizingWidget.style.width = `${newWidth}px`;
        resizingWidget.style.height = `${newHeight}px`;
    }
}

function handleMouseUp(e) {
    if (isDraggingWidget && draggedWidget) {
        draggedWidget.classList.remove('dragging');
        
        // Save new position
        const index = parseInt(draggedWidget.dataset.widgetIndex);
        if (dashboardWidgets[index]) {
            dashboardWidgets[index].x = parseInt(draggedWidget.style.left) || 0;
            dashboardWidgets[index].y = parseInt(draggedWidget.style.top) || 0;
            saveDashboardWidgets();
        }
        
        isDraggingWidget = false;
        draggedWidget = null;
    } else if (isResizing && resizingWidget) {
        resizingWidget.classList.remove('resizing');
        
        // Save new size
        const index = parseInt(resizingWidget.dataset.widgetIndex);
        if (dashboardWidgets[index]) {
            dashboardWidgets[index].w = parseInt(resizingWidget.style.width) || 320;
            dashboardWidgets[index].h = parseInt(resizingWidget.style.height) || 400;
            saveDashboardWidgets();
        }
        
        isResizing = false;
        resizingWidget = null;
    }
}

function addDashboardWidget(type, id, x, y) {
    // Check if widget already exists
    const exists = dashboardWidgets.some(w => w.type === type && w.id === id);
    if (exists) {
        showToast('Widget already exists on dashboard', 'info');
        return;
    }

    const newWidget = {
        id: id,
        type: type,
        x: x,
        y: y,
        w: 320,
        h: 400
    };

    dashboardWidgets.push(newWidget);
    saveDashboardWidgets();
    renderDashboard();
    showToast(`${type === 'folder' ? 'Folder' : 'Tag'} added to dashboard`, 'success');
}

function removeDashboardWidget(index) {
    dashboardWidgets.splice(index, 1);
    saveDashboardWidgets();
    renderDashboard();
    showToast('Widget removed', 'success');
}

function showWidgetColorPicker(index, button) {
    // Remove any existing color picker
    const existingPicker = document.querySelector('.widget-color-picker');
    if (existingPicker) {
        existingPicker.remove();
    }

    const widget = dashboardWidgets[index];
    if (!widget) return;

    // Color options
    const colors = [
        { name: 'Blue', value: '#6366f1' },
        { name: 'Purple', value: '#a855f7' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Orange', value: '#f97316' },
        { name: 'Yellow', value: '#eab308' },
        { name: 'Green', value: '#10b981' },
        { name: 'Teal', value: '#14b8a6' },
        { name: 'Cyan', value: '#06b6d4' },
        { name: 'Indigo', value: '#4f46e5' },
        { name: 'Gray', value: '#6b7280' },
        { name: 'Slate', value: '#475569' }
    ];

    // Create color picker
    const picker = document.createElement('div');
    picker.className = 'widget-color-picker';
    picker.innerHTML = `
        <div class="color-picker-grid">
            ${colors.map(c => `
                <button class="color-picker-option" 
                        data-color="${c.value}" 
                        title="${c.name}"
                        style="background: ${c.value}">
                    ${widget.color === c.value ? '<span class="color-check">✓</span>' : ''}
                </button>
            `).join('')}
        </div>
    `;

    // Position picker near button
    const rect = button.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = `${rect.bottom + 5}px`;
    picker.style.left = `${rect.left - 100}px`;

    document.body.appendChild(picker);

    // Setup color option handlers
    picker.querySelectorAll('.color-picker-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = opt.dataset.color;
            updateWidgetColor(index, color);
            picker.remove();
        });
    });

    // Close picker when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closePickerHandler(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closePickerHandler);
            }
        });
    }, 100);
}

function updateWidgetColor(index, color) {
    if (dashboardWidgets[index]) {
        dashboardWidgets[index].color = color;
        saveDashboardWidgets();
        renderDashboard();
        showToast('Widget color updated', 'success');
    }
}

function saveDashboardWidgets() {
    saveSettings({ dashboard_widgets: dashboardWidgets });
}

// Dashboard helpers
window.filterDashboardBookmarks = function (term) {
    const widgets = document.querySelectorAll('.dashboard-widget');
    const lowerTerm = term.toLowerCase();

    widgets.forEach(widget => {
        const items = widget.querySelectorAll('.compact-item');
        let hasVisible = false;

        items.forEach(item => {
            const text = item.querySelector('.compact-text')?.textContent.toLowerCase() || '';
            const matches = text.includes(lowerTerm);
            item.style.display = matches || !term ? '' : 'none';
            if (matches || !term) hasVisible = true;
        });

        // Don't hide entire widget, just dim it if no matches
        widget.style.opacity = hasVisible || !term ? '1' : '0.5';
    });
};

// Make switchDashboardTab globally available
function switchDashboardTab(id) {
    console.warn('Dashboard tabs are removed.');
}
window.switchDashboardTab = switchDashboardTab;

function renderBookmarks() {
    // Always show view toggle in bookmark views
    document.querySelector('.view-toggle').classList.remove('hidden');

    // Ensure correct class is set
    const classMap = {
        'grid': 'bookmarks-grid',
        'list': 'bookmarks-list',
        'masonry': 'bookmarks-masonry',
        'compact': 'bookmarks-compact'
    };
    bookmarksContainer.className = classMap[viewMode] || 'bookmarks-grid';

    const searchTerm = searchInput.value.toLowerCase();
    let filtered = bookmarks;

    if (searchTerm) {
        filtered = bookmarks.filter(b =>
            b.title.toLowerCase().includes(searchTerm) ||
            b.url.toLowerCase().includes(searchTerm) ||
            (b.tags && b.tags.toLowerCase().includes(searchTerm))
        );
    }
    // ... (rest of renderBookmarks)



    if (currentView === 'recent') {
        filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    } else {
        // Apply Filter Sort
        const sort = filterConfig.sort;
        filtered = filtered.filter(b => {
            // Tag Filter (Multi-select AND/OR)
            if (filterConfig.tags.length > 0) {
                if (!b.tags) return false;
                const bTags = b.tags.split(',').map(t => t.trim());
                
                if (filterConfig.tagMode === 'AND') {
                    // Bookmark must have ALL selected tags
                    return filterConfig.tags.every(t => bTags.includes(t));
                } else {
                    // Bookmark must have ANY selected tag (OR mode)
                    return filterConfig.tags.some(t => bTags.includes(t));
                }
            }
            return true;
        });

        // Apply sort using the same logic as sortBookmarks
        filtered.sort((a, b) => {
            switch (sort) {
                case 'a_z':
                case 'a-z':
                case 'alpha':
                    return a.title.localeCompare(b.title);
                case 'z_a':
                case 'z-a':
                    return b.title.localeCompare(a.title);
                case 'most_visited':
                    return (b.click_count || 0) - (a.click_count || 0);
                case 'oldest_first':
                case 'created_asc':
                case 'updated_asc':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'recently_added':
                case 'created_desc':
                case 'updated_desc':
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });
    }

    renderedBookmarks = filtered;

    if (filtered.length === 0) {
        bookmarksContainer.innerHTML = '';
        // Show contextual empty state
        let emptyMessage = getEmptyStateMessage();
        emptyState.innerHTML = emptyMessage;
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Lazy loading: only render displayedCount bookmarks initially
    const toRender = filtered.slice(0, displayedCount);
    const hasMore = filtered.length > displayedCount;

    bookmarksContainer.innerHTML = toRender.map((b, i) => createBookmarkCard(b, i)).join('');

    // Add "Load More" sentinel for infinite scroll
    if (hasMore) {
        bookmarksContainer.innerHTML += `
            < div id = "load-more-sentinel" class="load-more-sentinel" >
                <div class="loading-spinner"></div>
                <span>Loading more bookmarks...</span>
            </div >
            `;
        setupInfiniteScroll(filtered);
    }

    // Add event listeners
    attachBookmarkCardListeners();

    updateBulkUI();
    updateCounts();
}

function attachBookmarkCardListeners() {
    bookmarksContainer.querySelectorAll('.bookmark-card').forEach(card => {
        if (card.dataset.listenerAttached) return;
        card.dataset.listenerAttached = 'true';

        card.addEventListener('click', (e) => {
            const id = card.dataset.id;
            const index = parseInt(card.dataset.index, 10);

            if (e.target.closest('.bookmark-select')) return;
            if (e.target.closest('.bookmark-actions')) return;
            
            // Don't open bookmark if clicking on tags - let the event bubble to body handler
            if (e.target.closest('.bookmark-tags')) {
                return;
            }

            if (bulkMode) {
                // Always multi-select (additive) in bulk mode or simply by default as requested
                toggleBookmarkSelection(id, index, e.shiftKey, true);
                return;
            }

            const bookmark = bookmarks.find(b => b.id === id);
            if (bookmark) {
                trackClick(id);
                window.open(bookmark.url, '_blank');
            }
        });

        const checkbox = card.querySelector('.bookmark-select');
        if (checkbox) {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = card.dataset.id;
                const index = parseInt(card.dataset.index, 10);
                // Checkbox click is always multi/additive
                toggleBookmarkSelection(id, index, e.shiftKey, true);
            });
        }
    });
}

function setupInfiniteScroll(allFiltered) {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
            loadMoreBookmarks(allFiltered);
        }
    }, { rootMargin: '100px' });

    observer.observe(sentinel);
}

function loadMoreBookmarks(allFiltered) {
    if (isLoadingMore) return;
    if (displayedCount >= allFiltered.length) return;

    isLoadingMore = true;

    setTimeout(() => {
        const prevCount = displayedCount;
        displayedCount = Math.min(displayedCount + BOOKMARKS_PER_PAGE, allFiltered.length);

        const newBookmarks = allFiltered.slice(prevCount, displayedCount);
        const sentinel = document.getElementById('load-more-sentinel');

        // Insert new bookmarks before sentinel
        const newHtml = newBookmarks.map((b, i) => createBookmarkCard(b, prevCount + i)).join('');
        if (sentinel) {
            sentinel.insertAdjacentHTML('beforebegin', newHtml);
        }

        // Attach listeners to new cards
        attachBookmarkCardListeners();

        // Remove sentinel if no more to load
        if (displayedCount >= allFiltered.length && sentinel) {
            sentinel.remove();
        }

        isLoadingMore = false;
    }, 100);
}

function createBookmarkCard(bookmark, index) {
    const tags = bookmark.tags ? bookmark.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    const hostname = getHostname(bookmark.url);
    const isSelected = selectedBookmarks.has(bookmark.id);

    return `
    <div class="bookmark-card ${isSelected ? 'selected' : ''}" data-id="${bookmark.id}" data-index="${index}">
      <label class="bookmark-select">
        <input type="checkbox" ${isSelected ? 'checked' : ''}>
      </label>
      <div class="bookmark-header">
        <div class="bookmark-favicon">
          ${!hideFavicons && bookmark.favicon
            ? `<img src="${bookmark.favicon}" alt="" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path d=\\'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\\'/><path d=\\'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\\'/></svg>'">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
          }
        </div>
        <div class="bookmark-info">
          <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
          <div class="bookmark-url">${hostname}</div>
        </div>
      </div>
      ${bookmark.description ? `<div class="bookmark-description">${escapeHtml(bookmark.description)}</div>` : ''}
      ${tags.length ? `<div class="bookmark-tags">${tags.map(t => `<span class="tag" data-action="toggle-filter-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="bookmark-actions">
        <button class="bookmark-action-btn primary" data-action="open-bookmark" data-url="${escapeHtml(bookmark.url)}" title="Open bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span>Open</span>
        </button>
        <button class="bookmark-action-btn" data-action="edit-bookmark" data-id="${bookmark.id}" title="Edit bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>Edit</span>
        </button>
        <button class="bookmark-action-btn" data-action="copy-link" data-url="${escapeHtml(bookmark.url)}" title="Copy link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="bookmark-action-btn danger" data-action="delete-bookmark" data-id="${bookmark.id}" title="Delete bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div >
        `;
}

function toggleBookmarkSelection(id, index, isShift, isMulti) {
    if (isShift && lastSelectedIndex !== null && renderedBookmarks.length > 0) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
            selectedBookmarks.add(renderedBookmarks[i].id);
        }
    } else {
        if (selectedBookmarks.has(id)) {
            // If already selected:
            // If multi (Ctrl or check): Toggle Off.
            // If single (Click): Toggle Off (or should it keep? let's stick to toggle off behavior for consistency with previous code)
            if (isMulti) {
                selectedBookmarks.delete(id);
            } else {
                selectedBookmarks.delete(id);
                // Also clear others? Original code didn't clear others if you deselect the current one.
                // But usually single click implies "Select ONLY this" or "Deselect this".
                // If I click a selected item in single mode, and others are selected (how?), they remain?
                // `if (selectedBookmarks.has(id) && !isMulti) selectedBookmarks.delete(id)` matches original.
            }
        } else {
            // Not selected:
            if (!isMulti) selectedBookmarks.clear();
            selectedBookmarks.add(id);
        }
        lastSelectedIndex = index;
    }

    bulkMode = selectedBookmarks.size > 0;
    updateBulkUI();
    renderBookmarks();
}

function clearSelections() {
    selectedBookmarks.clear();
    bulkMode = false;
    lastSelectedIndex = null;
    updateBulkUI();
    renderBookmarks();
}

function selectAllBookmarks() {
    renderedBookmarks.forEach(b => selectedBookmarks.add(b.id));
    if (selectedBookmarks.size > 0) {
        bulkMode = true;
    }
    updateBulkUI();
    renderBookmarks();
}

function updateBulkUI() {
    if (!bulkBar) return;
    if (selectedBookmarks.size === 0) {
        bulkBar.classList.add('hidden');
        return;
    }
    bulkBar.classList.remove('hidden');
    if (bulkCount) bulkCount.textContent = `${selectedBookmarks.size} selected`;
    populateBulkMoveSelect();
}

function populateBulkMoveSelect() {
    if (!bulkMoveSelect) return;
    bulkMoveSelect.innerHTML = '<option value="">Choose folder</option>' +
        folders.map(f => `< option value = "${f.id}" > ${escapeHtml(f.name)}</option > `).join('');
}

async function bulkDelete() {
    if (selectedBookmarks.size === 0) return;
    if (!confirm(`Delete ${selectedBookmarks.size} bookmark(s) ? `)) return;
    const ids = Array.from(selectedBookmarks);
    for (const id of ids) {
        await api(`/ bookmarks / ${id} `, { method: 'DELETE' });
    }
    bookmarks = bookmarks.filter(b => !selectedBookmarks.has(b.id));
    clearSelections();
    updateCounts();
    showToast('Bookmarks deleted', 'success');
}

async function bulkFavorite() {
    if (selectedBookmarks.size === 0) return;
    const ids = Array.from(selectedBookmarks);
    for (const id of ids) {
        await api(`/ bookmarks / ${id} `, {
            method: 'PUT',
            body: JSON.stringify({ is_favorite: 1 })
        });
        const bm = bookmarks.find(b => b.id === id);
        if (bm) bm.is_favorite = 1;
    }
    renderBookmarks();
    updateCounts();
    showToast('Marked as favorite', 'success');
}

async function bulkMove() {
    if (!bulkMoveSelect) return;
    const folderId = bulkMoveSelect.value || null;
    if (folderId === null) return;
    const ids = Array.from(selectedBookmarks);
    for (const id of ids) {
        await api(`/ bookmarks / ${id} `, {
            method: 'PUT',
            body: JSON.stringify({ folder_id: folderId })
        });
        const bm = bookmarks.find(b => b.id === id);
        if (bm) bm.folder_id = folderId;
    }
    clearSelections();
    updateCounts();
    showToast('Bookmarks moved', 'success');
}

async function bulkAddTags() {
    if (selectedBookmarks.size === 0) return;
    const raw = prompt('Add tags (comma separated):');
    const tagsToAdd = parseTagInput(raw || '');
    if (tagsToAdd.length === 0) return;

    const ids = Array.from(selectedBookmarks);
    await api('/tags/bulk-add', {
        method: 'POST',
        body: JSON.stringify({ bookmark_ids: ids, tags: tagsToAdd })
    });

    bookmarks = bookmarks.map(b => {
        if (!selectedBookmarks.has(b.id)) return b;
        const merged = new Set([...parseTagInput(b.tags || ''), ...tagsToAdd]);
        return { ...b, tags: Array.from(merged).join(', ') };
    });

    clearSelections();
    updateCounts();
    renderBookmarks();
    renderSidebarTags();
    showToast('Tags added to selection', 'success');
}

async function bulkRemoveTags() {
    if (selectedBookmarks.size === 0) return;
    const raw = prompt('Remove tags (comma separated):');
    const tagsToRemove = parseTagInput(raw || '');
    if (tagsToRemove.length === 0) return;

    const ids = Array.from(selectedBookmarks);
    await api('/tags/bulk-remove', {
        method: 'POST',
        body: JSON.stringify({ bookmark_ids: ids, tags: tagsToRemove })
    });

    const removeSet = new Set(tagsToRemove.map(t => t.toLowerCase()));
    bookmarks = bookmarks.map(b => {
        if (!selectedBookmarks.has(b.id) || !b.tags) return b;
        const filtered = parseTagInput(b.tags).filter(t => !removeSet.has(t.toLowerCase()));
        return { ...b, tags: filtered.join(', ') };
    });

    clearSelections();
    updateCounts();
    renderBookmarks();
    renderSidebarTags();
    showToast('Tags removed from selection', 'success');
}

async function renameTagAcross(from, to) {
    if (!from || !to) return;
    await api('/tags/rename', {
        method: 'POST',
        body: JSON.stringify({ from, to })
    });

    bookmarks = bookmarks.map(b => {
        if (!b.tags) return b;
        const tags = parseTagInput(b.tags).map(t => (t === from ? to : t));
        const merged = Array.from(new Set(tags)).join(', ');
        return { ...b, tags: merged };
    });

    renderBookmarks();
    renderSidebarTags();
    await loadTagStats();
    lastTagRenameAction = { from, to };
    updateTagRenameUndoButton();
    showToast(`Renamed ${from} → ${to} `, 'success');
}

async function loadTagStats() {
    if (!tagStatsList) return;
    try {
        const tags = await api('/tags');
        if (!tags || tags.length === 0) {
            tagStatsList.innerHTML = '<div class="text-tertiary" style="font-size:0.9rem;">No tags yet</div>';
            updateTagRenameUndoButton();
            return;
        }

        tagStatsList.innerHTML = tags.map(t => {
            const path = t.parent ? `< div class="tag-path" > ${escapeHtml(t.parent)}</div > ` : '';
            return `< div class="tag-stat-item" ><div>${escapeHtml(t.name)}${path}</div><span class="badge">${t.count}</span></div > `;
        }).join('');
        updateTagRenameUndoButton();
    } catch (err) {
        tagStatsList.innerHTML = '<div class="text-tertiary" style="font-size:0.9rem;">Failed to load tags</div>';
        updateTagRenameUndoButton();
    }
}

function updateTagRenameUndoButton() {
    if (!tagRenameUndoBtn) return;
    if (lastTagRenameAction) {
        tagRenameUndoBtn.disabled = false;
        tagRenameUndoBtn.textContent = `Undo ${lastTagRenameAction.from} → ${lastTagRenameAction.to} `;
    } else {
        tagRenameUndoBtn.disabled = true;
        tagRenameUndoBtn.textContent = 'Undo last rename';
    }
}

function getCommandPaletteCommands() {
    const baseCommands = [
        { label: 'Add bookmark', action: () => openModal('bookmark-modal') },
        { label: 'Focus search', action: () => searchInput.focus() },
        {
            label: 'Show dashboard',
            action: () => {
                currentView = 'dashboard';
                currentFolder = null;
                updateActiveNav();
                viewTitle.textContent = 'Dashboard';
                loadBookmarks();
            }
        },
        {
            label: 'View favorites',
            action: () => {
                currentView = 'favorites';
                currentFolder = null;
                updateActiveNav();
                viewTitle.textContent = 'Favorites';
                loadBookmarks();
            }
        },
        {
            label: 'View all',
            action: () => {
                currentView = 'all';
                currentFolder = null;
                updateActiveNav();
                viewTitle.textContent = 'Bookmarks';
                loadBookmarks();
            }
        },
        { label: 'Open settings', action: () => openModal('settings-modal') },
    ];

    const folderCommands = folders
        .filter(f => !f.parent_id)
        .map(f => ({
            label: `Go to ${f.name} `,
            action: () => {
                currentView = 'folder';
                currentFolder = f.id;
                viewTitle.textContent = f.name;
                updateActiveNav();
                loadBookmarks();
            }
        }));

    return [...baseCommands, ...folderCommands];
}

function openCommandPalette() {
    if (!commandPalette) return;
    commandPaletteOpen = true;
    commandPalette.classList.remove('hidden');
    if (commandPaletteInput) commandPaletteInput.value = '';
    commandPaletteActiveIndex = 0;
    renderCommandPaletteList('');
    commandPaletteInput?.focus();
}

function closeCommandPalette() {
    if (!commandPalette) return;
    commandPaletteOpen = false;
    commandPalette.classList.add('hidden');
}

function renderCommandPaletteList(filterText) {
    if (!commandPaletteList) return;
    const term = (filterText || '').toLowerCase();
    commandPaletteEntries = getCommandPaletteCommands().filter(cmd => cmd.label.toLowerCase().includes(term));
    commandPaletteActiveIndex = 0;

    if (commandPaletteEntries.length === 0) {
        commandPaletteList.innerHTML = '<div class="command-item">No matches</div>';
        return;
    }

    commandPaletteList.innerHTML = commandPaletteEntries.map((cmd, idx) => `
        < div class="command-item ${idx === commandPaletteActiveIndex ? 'active' : ''}" data - index="${idx}" >
            <span>${escapeHtml(cmd.label)}</span>
        </div >
        `).join('');
}

function updateCommandPaletteActive(direction) {
    if (!commandPaletteList || commandPaletteEntries.length === 0) return;
    commandPaletteActiveIndex = Math.max(0, Math.min(commandPaletteEntries.length - 1, commandPaletteActiveIndex + direction));
    commandPaletteList.querySelectorAll('.command-item').forEach((item, idx) => {
        item.classList.toggle('active', idx === commandPaletteActiveIndex);
    });
    const active = commandPaletteList.querySelector('.command-item.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function runActiveCommand() {
    const cmd = commandPaletteEntries[commandPaletteActiveIndex];
    if (!cmd) return;
    closeCommandPalette();
    cmd.action();
}

// Shortcuts Help Popup
function openShortcutsPopup() {
    const popup = document.getElementById('shortcuts-popup');
    if (!popup) return;
    popup.classList.remove('hidden');
}

function closeShortcutsPopup() {
    const popup = document.getElementById('shortcuts-popup');
    if (!popup) return;
    popup.classList.add('hidden');
}

async function createBookmark(data) {
    try {
        const bookmark = await api('/bookmarks', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        bookmarks.unshift(bookmark);
        renderBookmarks();
        updateCounts();
        closeModals();
        showToast('Bookmark added!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function updateBookmark(id, data) {
    try {
        const bookmark = await api(`/bookmarks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        const index = bookmarks.findIndex(b => b.id === id);
        if (index !== -1) bookmarks[index] = bookmark;
        renderBookmarks();
        updateCounts();
        closeModals();
        showToast('Bookmark updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteBookmark(id) {
    if (!confirm('Delete this bookmark?')) return;

    try {
        await api(`/bookmarks/${id}`, { method: 'DELETE' });
        bookmarks = bookmarks.filter(b => b.id !== id);
        renderBookmarks();
        updateCounts();
        showToast('Bookmark deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleFavorite(id) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return;

    try {
        await api(`/bookmarks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_favorite: bookmark.is_favorite ? 0 : 1 })
        });
        bookmark.is_favorite = bookmark.is_favorite ? 0 : 1;
        renderBookmarks();
        updateCounts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function trackClick(id) {
    try {
        await api(`/bookmarks/${id}/click`, { method: 'POST' });
    } catch (err) {
        // Silent fail
    }
}

function editBookmark(id) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return;

    document.getElementById('bookmark-modal-title').textContent = 'Edit Bookmark';
    document.getElementById('bookmark-id').value = id;
    document.getElementById('bookmark-url').value = bookmark.url;
    document.getElementById('bookmark-title').value = bookmark.title;
    document.getElementById('bookmark-description').value = bookmark.description || '';
    document.getElementById('bookmark-folder').value = bookmark.folder_id || '';
    document.getElementById('bookmark-tags').value = bookmark.tags || '';

    openModal('bookmark-modal');
    showTagSuggestions(bookmark.url);
}

// Folders
async function loadFolders() {
    try {
        folders = await api('/folders');
        renderFolders();
        updateFolderSelect();
        populateBulkMoveSelect();
    } catch (err) {
        showToast('Failed to load folders', 'error');
    }
}

function renderFolders() {
    const container = document.getElementById('folders-list');
    const showMoreBtn = document.getElementById('folders-show-more');

    // Build hierarchy
    const rootFolders = folders.filter(f => !f.parent_id);

    // Sort logic (same as before but applied at each level)
    const sorter = (a, b) => {
        const countA = bookmarks.filter(bm => bm.folder_id === a.id).length;
        const countB = bookmarks.filter(bm => bm.folder_id === b.id).length;
        if (countA > 0 && countB === 0) return -1;
        if (countA === 0 && countB > 0) return 1;
        return a.name.localeCompare(b.name);
    };

    rootFolders.sort(sorter);

    function renderFolderTree(folderList, level = 0) {
        return folderList.map(f => {
            const children = folders.filter(child => child.parent_id === f.id).sort(sorter);
            const count = bookmarks.filter(b => b.folder_id === f.id).length; // Only counts direct bookmarks? Or total? Usually direct.
            const isEmpty = count === 0;
            const indentation = level * 12; // px indentation per level

            return `
            <div class="nav-item folder-item ${currentFolder === f.id ? 'active' : ''} ${isEmpty ? 'empty' : ''}" 
                 data-folder="${f.id}" 
                 data-folder-name="${escapeHtml(f.name)}"
                 data-folder-color="${f.color}"
                 draggable="true"
                 style="padding-left: ${12 + indentation}px; cursor: grab;">
                <span class="folder-color" style="background: ${f.color}"></span>
                <span class="folder-name">${escapeHtml(f.name)}</span>
                ${count > 0 ? `<span class="badge">${count}</span>` : ''}
                <div class="folder-actions">
                    <button class="btn-icon" data-action="edit-folder" data-id="${f.id}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button class="btn-icon" data-action="delete-folder" data-id="${f.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>
            ${renderFolderTree(children, level + 1)}
            `;
        }).join('');
    }

    container.innerHTML = renderFolderTree(rootFolders);

    container.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't navigate if currently dragging
            if (e.defaultPrevented) return;
            
            currentFolder = item.dataset.folder;
            currentView = 'folder';
            updateActiveNav();
            loadBookmarks();
            const folder = folders.find(f => f.id === currentFolder);
            viewTitle.textContent = folder ? folder.name : 'Folder';
        });
        
        // Setup drag for dashboard
        if (item.getAttribute('draggable') === 'true') {
            item.addEventListener('dragstart', (e) => {
                draggedSidebarItem = {
                    type: 'folder',
                    id: item.dataset.folder,
                    name: item.dataset.folderName,
                    color: item.dataset.folderColor
                };
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', item.dataset.folderName);
            });

            item.addEventListener('dragend', () => {
                draggedSidebarItem = null;
            });
        }
    });
    
    // Reinitialize popouts if sidebar is collapsed
    if (document.body.classList.contains('sidebar-collapsed')) {
        removeSidebarPopouts();
        setTimeout(() => initSidebarPopouts(), 50);
    }
}

function updateFolderSelect() {
    // Populate for bookmarks (flattened list with indentation)
    const select = document.getElementById('bookmark-folder');
    if (!select) return;

    let options = '<option value="">None</option>';

    // Sort logic
    const sorter = (a, b) => a.name.localeCompare(b.name);

    function buildOptions(parent_id, level = 0) {
        const children = folders.filter(f => f.parent_id === parent_id).sort(sorter);
        children.forEach(f => {
            const prefix = '&nbsp;&nbsp;&nbsp;'.repeat(level);
            options += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
            buildOptions(f.id, level + 1);
        });
    }

    buildOptions(null);
    select.innerHTML = options;
}

function updateFolderParentSelect(currentId = null) {
    const select = document.getElementById('folder-parent');
    if (!select) return;

    let options = '<option value="">None (Top Level)</option>';

    // Helper to check for cycles if currentId is provided
    function isDescendant(potentialParentId) {
        if (!currentId) return false;
        if (potentialParentId === currentId) return true; // Can't be own parent

        let parent = folders.find(f => f.id === potentialParentId);
        while (parent) {
            if (parent.id === currentId) return true;
            parent = folders.find(f => f.id === parent.parent_id);
        }
        return false;
    }

    const sorter = (a, b) => a.name.localeCompare(b.name);

    function buildOptions(parent_id, level = 0) {
        const children = folders.filter(f => f.parent_id === parent_id).sort(sorter);
        children.forEach(f => {
            // Can't select self or descendants as parent
            if (currentId && (f.id === currentId || isDescendant(f.id))) return;

            const prefix = '&nbsp;&nbsp;&nbsp;'.repeat(level);
            options += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
            buildOptions(f.id, level + 1);
        });
    }

    buildOptions(null);
    select.innerHTML = options;
}

async function createFolder(data) {
    try {
        const folder = await api('/folders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        folders.push(folder);
        renderFolders();
        updateFolderSelect();
        closeModals();
        showToast('Folder created!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function updateFolder(id, data) {
    try {
        const folder = await api(`/folders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        const index = folders.findIndex(f => f.id === id);
        if (index !== -1) folders[index] = folder;
        renderFolders();
        updateFolderSelect();
        closeModals();
        showToast('Folder updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteFolder(id) {
    if (!confirm('Delete this folder? Bookmarks will be moved to uncategorized.')) return;

    try {
        await api(`/folders/${id}`, { method: 'DELETE' });
        folders = folders.filter(f => f.id !== id);
        if (currentFolder === id) {
            currentFolder = null;
            currentView = 'all';
            viewTitle.textContent = 'Bookmarks';
        }
        renderFolders();
        updateFolderSelect();
        loadBookmarks();
        showToast('Folder deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function editFolder(id) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    document.getElementById('folder-modal-title').textContent = 'Edit Folder';
    document.getElementById('folder-id').value = id;
    document.getElementById('folder-name').value = folder.name;
    document.getElementById('folder-color').value = folder.color;

    // Set active color
    document.querySelectorAll('.color-option').forEach(opt => {
        if (opt.dataset.color === folder.color) opt.classList.add('active');
        else opt.classList.remove('active');
    });

    updateFolderParentSelect(id);
    document.getElementById('folder-parent').value = folder.parent_id || '';

    openModal('folder-modal');
}

// Helper function to navigate to a folder by index using keyboard shortcuts
function navigateToFolderByIndex(index) {
    const rootFolders = folders.filter(f => !f.parent_id);
    
    if (index < 0 || index >= rootFolders.length) {
        return; // Out of range, silently return
    }

    const folder = rootFolders[index];
    currentFolder = folder.id;
    currentView = 'folder';
    viewTitle.textContent = folder.name;
    updateActiveNav();
    loadBookmarks();
}

// Sidebar Tags
function renderSidebarTags() {
    const container = document.getElementById('sidebar-tags-list');
    const countBadge = document.getElementById('tags-count');
    const showMoreBtn = document.getElementById('tags-show-more');
    if (!container) return;

    // Calculate tag counts
    const tagCounts = {};
    bookmarks.forEach(b => {
        if (b.tags) {
            b.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    // Build sorted tags array
    allSidebarTags = Object.keys(tagCounts)
        .map(name => ({ name, count: tagCounts[name] }))
        .sort((a, b) => b.count - a.count);

    if (countBadge) countBadge.textContent = allSidebarTags.length;

    // Show "show more" if more than 15 tags
    if (showMoreBtn) {
        if (allSidebarTags.length > 15 && !showingAllTags) {
            showMoreBtn.classList.remove('hidden');
            showMoreBtn.textContent = `Show all ${allSidebarTags.length} tags`;
        } else {
            showMoreBtn.classList.add('hidden');
        }
    }

    // Render tags list
    const tagsToShow = showingAllTags ? allSidebarTags.slice(0, 100) : allSidebarTags.slice(0, 15);
    renderTagsList(tagsToShow);
}

function sidebarFilterTag(tag) {
    // Ensure we are in the "all" view and clear folder context
    currentView = 'all';
    currentFolder = null;
    searchInput.value = '';

    // Toggle tag selection for multi-select support
    const idx = filterConfig.tags.indexOf(tag);
    if (idx === -1) {
        // Add tag
        filterConfig.tags.push(tag);
    } else {
        // Remove tag
        filterConfig.tags.splice(idx, 1);
    }

    // Update view title to reflect selected tags
    if (filterConfig.tags.length === 0) {
        viewTitle.textContent = 'Bookmarks';
    } else {
        viewTitle.textContent = `Tags: ${filterConfig.tags.join(', ')}`;
    }

    updateActiveNav();
    renderActiveFilters();
    renderBookmarks();
    renderSidebarTags();
    updateActiveFilters();
}

// Sidebar Section Toggle
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');
        
        if (isCollapsed) {
            if (!collapsedSections.includes(sectionId)) {
                collapsedSections.push(sectionId);
            }
        } else {
            collapsedSections = collapsedSections.filter(id => id !== sectionId);
        }
        
        saveSettings({ collapsed_sections: collapsedSections });
    }
}

// Filter sidebar tags
let allSidebarTags = [];
let showingAllTags = false;

function filterSidebarTags(searchTerm) {
    const container = document.getElementById('sidebar-tags-list');
    if (!container) return;

    const filtered = allSidebarTags.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    renderTagsList(filtered.slice(0, showingAllTags ? 100 : 15));
}

function showAllTags() {
    showingAllTags = true;
    const btn = document.getElementById('tags-show-more');
    if (btn) btn.classList.add('hidden');
    renderTagsList(allSidebarTags.slice(0, 100));
}

function showAllFolders() {
    const btn = document.getElementById('folders-show-more');
    if (btn) btn.classList.add('hidden');
    // Re-render folders without limit
    renderFolders(true);
}

function renderTagsList(tags) {
    const container = document.getElementById('sidebar-tags-list');
    if (!container) return;

    if (tags.length === 0) {
        container.innerHTML = '<div style="padding: 0.5rem; font-size: 0.75rem; color: var(--text-tertiary);">No tags found</div>';
        return;
    }

    // Clear existing content
    container.innerHTML = '';
    tags.forEach(tag => {
        const div = document.createElement('div');
        div.className = `sidebar-tag-item ${filterConfig.tags.includes(tag.name) ? 'active' : ''}`;
        div.draggable = true;
        div.style.cursor = 'grab';
        div.dataset.tagName = tag.name;
        div.dataset.tagCount = tag.count;
        div.innerHTML = `
            <span class="tag-name">${escapeHtml(tag.name)}</span>
            <span class="tag-count">${tag.count}</span>
        `;
        div.addEventListener('click', (e) => {
            // Don't filter if currently dragging
            if (e.defaultPrevented) return;
            sidebarFilterTag(tag.name);
        });
        
        // Setup drag for dashboard
        div.addEventListener('dragstart', (e) => {
            draggedSidebarItem = {
                type: 'tag',
                id: tag.name,
                name: tag.name,
                color: '#10b981'
            };
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', tag.name);
        });

        div.addEventListener('dragend', () => {
            draggedSidebarItem = null;
        });
        
        container.appendChild(div);
    });
}

// Clear all filters
function clearAllFilters() {
    filterConfig.tags = [];
    filterConfig.sort = 'recently_added';
    searchInput.value = '';
    currentView = 'all';
    currentFolder = null;
    viewTitle.textContent = 'Bookmarks';
    updateActiveNav();
    renderActiveFilters();
    renderBookmarks();
    renderSidebarTags();
    updateActiveFilters();
}

// Update active filters display
function updateActiveFilters() {
    renderActiveFilters();
}

function removeTagFilter(tag) {
    filterConfig.tags = filterConfig.tags.filter(t => t !== tag);
    renderActiveFilters();
    renderBookmarks();
    renderSidebarTags();
    updateActiveFilters();
    if (filterConfig.tags.length === 0) {
        viewTitle.textContent = 'Bookmarks';
    }
}

function clearSearch() {
    searchInput.value = '';
    renderBookmarks();
    updateActiveFilters();
}

// Update stats bar
function updateStats() {
    const statBookmarks = document.getElementById('stat-bookmarks');
    const statFolders = document.getElementById('stat-folders');
    const statTags = document.getElementById('stat-tags');
    const foldersCount = document.getElementById('folders-count');

    // Show currently displayed bookmarks count, not total
    if (statBookmarks) statBookmarks.textContent = renderedBookmarks.length;
    if (statFolders) statFolders.textContent = folders.length;
    if (foldersCount) foldersCount.textContent = folders.length;

    // Count unique tags from currently displayed bookmarks
    const tagSet = new Set();
    renderedBookmarks.forEach(b => {
        if (b.tags) {
            b.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagSet.add(tag);
            });
        }
    });
    if (statTags) statTags.textContent = tagSet.size;
}

// Navigation
function updateActiveNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (currentView === 'folder') {
        document.querySelector(`.folder-item[data-folder="${currentFolder}"]`)?.classList.add('active');
    } else if (currentView === 'dashboard') {
        document.querySelector(`.nav-item[data-view="dashboard"]`)?.classList.add('active');
    } else {
        document.querySelector(`.nav-item[data-view="${currentView}"]`)?.classList.add('active');
    }
}

function updateCounts() {
    const allCount = bookmarks.length;
    const favCount = bookmarks.filter(b => b.is_favorite).length;
    const viewCount = renderedBookmarks.length;

    document.getElementById('all-count').textContent = allCount;
    document.getElementById('fav-count').textContent = favCount;
    document.getElementById('view-count').textContent = `${viewCount} bookmark${viewCount !== 1 ? 's' : ''}`;

    renderFolders();
    updateStats();
}

// View Mode
function setViewMode(mode) {
    viewMode = mode;
    saveSettings({ view_mode: mode });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.viewMode === mode);
    });

    // Set the appropriate class based on view mode
    const classMap = {
        'grid': 'bookmarks-grid',
        'list': 'bookmarks-list',
        'masonry': 'bookmarks-masonry',
        'compact': 'bookmarks-compact'
    };

    bookmarksContainer.className = classMap[mode] || 'bookmarks-grid';
    renderBookmarks();
}

// Theme
function applyTheme() {
    // Theme is applied when settings are loaded
}

function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    saveSettings({ theme: newTheme });
}

// Favicon Setting
function applyFaviconSetting() {
    const toggle = document.getElementById('hide-favicons-toggle');
    if (toggle) toggle.checked = hideFavicons;
}

function toggleFavicons() {
    const toggle = document.getElementById('hide-favicons-toggle');
    hideFavicons = toggle?.checked || false;
    saveSettings({ hide_favicons: hideFavicons });
    // Re-render to apply change
    if (currentView === 'dashboard') {
        renderDashboard();
    } else {
        renderBookmarks();
    }
}

function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('anchormarks_sidebar_collapsed', isCollapsed);
    
    // Initialize or remove popout handlers
    if (isCollapsed) {
        initSidebarPopouts();
    } else {
        removeSidebarPopouts();
    }
}

// Sidebar Popout for Collapsed State
let sidebarPopout = null;
let popoutTimeout = null;

function initSidebarPopouts() {
    // Create popout element if it doesn't exist
    if (!sidebarPopout) {
        sidebarPopout = document.createElement('div');
        sidebarPopout.className = 'sidebar-popout';
        document.body.appendChild(sidebarPopout);
    }
    
    // Add event listeners to nav sections when collapsed
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    // Handle folder sections
    sidebar.querySelectorAll('.nav-section').forEach(section => {
        const header = section.querySelector('.nav-section-header');
        if (!header) return;
        
        header.addEventListener('mouseenter', handleSectionHover);
        header.addEventListener('mouseleave', handlePopoutLeave);
        header.addEventListener('click', handleSectionClick);
    });
    
    // Handle individual nav items
    sidebar.querySelectorAll('.nav-item').forEach(item => {
        // Skip items that are inside sections (they'll be in popout)
        if (!item.closest('.nav-section-content')) {
            item.addEventListener('mouseenter', handleNavItemHover);
            item.addEventListener('mouseleave', handlePopoutLeave);
        }
    });
}

function removeSidebarPopouts() {
    if (sidebarPopout) {
        sidebarPopout.classList.remove('show');
    }
    
    // Remove event listeners
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    sidebar.querySelectorAll('.nav-section-header').forEach(header => {
        header.removeEventListener('mouseenter', handleSectionHover);
        header.removeEventListener('mouseleave', handlePopoutLeave);
        header.removeEventListener('click', handleSectionClick);
    });
    
    sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.removeEventListener('mouseenter', handleNavItemHover);
        item.removeEventListener('mouseleave', handlePopoutLeave);
    });
}

function handleSectionHover(e) {
    if (!document.body.classList.contains('sidebar-collapsed')) return;
    
    clearTimeout(popoutTimeout);
    const section = e.currentTarget.closest('.nav-section');
    if (!section) return;
    
    popoutTimeout = setTimeout(() => {
        showSectionPopout(section, e.currentTarget);
    }, 300);
}

function handleSectionClick(e) {
    if (!document.body.classList.contains('sidebar-collapsed')) return;
    
    const section = e.currentTarget.closest('.nav-section');
    if (!section) return;
    
    if (sidebarPopout && sidebarPopout.classList.contains('show') && sidebarPopout._currentSection === section) {
        hidePopout();
    } else {
        showSectionPopout(section, e.currentTarget);
    }
}

function handleNavItemHover(e) {
    if (!document.body.classList.contains('sidebar-collapsed')) return;
    // For now, just show tooltip on hover - could expand this later
}

function handlePopoutLeave(e) {
    clearTimeout(popoutTimeout);
    
    // Check if mouse is entering the popout
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && (relatedTarget === sidebarPopout || sidebarPopout.contains(relatedTarget))) {
        return;
    }
    
    popoutTimeout = setTimeout(() => {
        hidePopout();
    }, 200);
}

function showSectionPopout(section, headerElement) {
    if (!sidebarPopout) return;
    
    const content = section.querySelector('.nav-section-content');
    if (!content) return;
    
    const headerText = headerElement.querySelector('span')?.textContent || 'Items';
    const items = content.querySelectorAll('.folder-item, .nav-item');
    
    if (items.length === 0) return;
    
    // Build popout content
    let html = `<div class="sidebar-popout-header">${headerText}</div>`;
    html += '<div class="sidebar-popout-content">';
    
    items.forEach(item => {
        const clone = item.cloneNode(true);
        // Make sure text is visible in popout
        clone.style.opacity = '1';
        const textElements = clone.querySelectorAll('span, .folder-name, .badge');
        textElements.forEach(el => {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
        });
        html += clone.outerHTML;
    });
    
    html += '</div>';
    
    sidebarPopout.innerHTML = html;
    sidebarPopout._currentSection = section;
    
    // Position popout
    const rect = headerElement.getBoundingClientRect();
    sidebarPopout.style.top = `${rect.top}px`;
    sidebarPopout.style.left = '70px';
    
    // Show popout
    sidebarPopout.classList.add('show');
    
    // Re-attach event listeners to cloned items
    sidebarPopout.querySelectorAll('.folder-item, .nav-item').forEach((item, index) => {
        const originalItem = items[index];
        
        // Handle main item click (navigate to folder/view)
        const mainClickArea = item;
        mainClickArea.addEventListener('click', (e) => {
            // Don't navigate if clicking on action buttons
            if (e.target.closest('.folder-actions')) {
                return;
            }
            originalItem.click();
            hidePopout();
        });
        
        // Handle folder action buttons
        const editBtn = item.querySelector('[data-action="edit-folder"]');
        const deleteBtn = item.querySelector('[data-action="delete-folder"]');
        
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const originalEditBtn = originalItem.querySelector('[data-action="edit-folder"]');
                originalEditBtn?.click();
                hidePopout();
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const originalDeleteBtn = originalItem.querySelector('[data-action="delete-folder"]');
                originalDeleteBtn?.click();
                hidePopout();
            });
        }
    });
    
    // Keep popout open when hovering over it
    sidebarPopout.addEventListener('mouseenter', () => {
        clearTimeout(popoutTimeout);
    });
    
    sidebarPopout.addEventListener('mouseleave', () => {
        popoutTimeout = setTimeout(() => {
            hidePopout();
        }, 200);
    });
}

function hidePopout() {
    if (sidebarPopout) {
        sidebarPopout.classList.remove('show');
        sidebarPopout._currentSection = null;
    }
}

// Active Filters Section
function toggleFilterSidebar() {
    // Stub for backward compatibility - filter sidebar controls now update active-filters-section
}

function renderActiveFilters() {
    const section = document.getElementById('active-filters-section');
    const chipsContainer = document.getElementById('active-filters-chips');
    if (!section || !chipsContainer) return;

    const hasFilters = filterConfig.tags.length > 0 || searchInput.value.trim();

    if (!hasFilters) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    let html = '';
    
    // Tag mode button (show when tags are selected)
    if (filterConfig.tags.length > 0) {
        html += `
            <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;">
                <button id="filter-tag-mode-btn" data-action="toggle-tag-mode" class="tag-mode-btn ${filterConfig.tagMode === 'AND' ? 'and-mode' : 'or-mode'}">
                    Match: ${filterConfig.tagMode}
                </button>
                <span style="font-size: 12px; color: var(--text-muted);">${filterConfig.tags.length} tag${filterConfig.tags.length !== 1 ? 's' : ''} selected</span>
            </div>
        `;
    }

    // Selected tag chips
    let chips = '';
    filterConfig.tags.forEach(tag => {
        chips += `
            <div class="filter-chip">
                <span>${escapeHtml(tag)}</span>
                <button data-action="remove-tag-filter" data-tag="${escapeHtml(tag)}" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    });

    if (searchInput.value.trim()) {
        chips += `
            <div class="filter-chip">
                <span>Search: ${escapeHtml(searchInput.value)}</span>
                <button data-action="clear-search" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }

    html += chips;
    chipsContainer.innerHTML = html;
}

function toggleFilterTag(tag) {
    if (filterConfig.tags.includes(tag)) {
        filterConfig.tags = filterConfig.tags.filter(t => t !== tag);
    } else {
        filterConfig.tags.push(tag);
    }
    
    // Update view state
    currentView = 'all';
    currentFolder = null;
    searchInput.value = '';
    
    // Update title
    if (filterConfig.tags.length === 0) {
        viewTitle.textContent = 'Bookmarks';
    } else {
        viewTitle.textContent = `Tags: ${filterConfig.tags.join(', ')} (${filterConfig.tagMode})`;
    }
    
    updateActiveNav();
    renderActiveFilters();
    renderSidebarTags();
    updateActiveFilters();
    renderBookmarks();
}

function toggleTagMode() {
    filterConfig.tagMode = filterConfig.tagMode === 'OR' ? 'AND' : 'OR';
    
    // Update title
    if (filterConfig.tags.length > 0) {
        viewTitle.textContent = `Tags: ${filterConfig.tags.join(', ')} (${filterConfig.tagMode})`;
    }
    
    renderActiveFilters();
    renderBookmarks();
}

window.toggleFilterTag = toggleFilterTag;
window.toggleTagMode = toggleTagMode;

// Dashboard Settings
async function loadDashboardSettings() {
    console.log('loadDashboardSettings called');

    const modeSelect = document.getElementById('dashboard-mode-select');
    const sortSelect = document.getElementById('dashboard-bookmark-sort');
    const tagsList = document.getElementById('dashboard-tags-list');
    const tagSearch = document.getElementById('dashboard-tag-search');
    const tagSort = document.getElementById('dashboard-tag-sort');

    console.log('Elements found:', { modeSelect: !!modeSelect, tagsList: !!tagsList, sortSelect: !!sortSelect });

    // Check if elements exist
    if (!modeSelect || !tagsList) {
        console.error('Dashboard settings elements not found');
        return;
    }

    // Set current values
    modeSelect.value = dashboardConfig.mode;
    if (sortSelect) sortSelect.value = dashboardConfig.bookmarkSort || 'recently_added';

    // Show loading state
    console.log('Setting loading state...');
    tagsList.innerHTML = '<p style="color:var(--text-tertiary);padding:1rem;text-align:center">Loading tags...</p>';

    // Fetch ALL bookmarks directly to get all tags (not the filtered subset)
    let allBookmarks = [];
    try {
        console.log('Fetching bookmarks...');
        allBookmarks = await api('/bookmarks');
        console.log('Fetched', allBookmarks.length, 'bookmarks');
    } catch (err) {
        console.error('Failed to load bookmarks for settings:', err);
        tagsList.innerHTML = '<p style="color:var(--danger);padding:1rem">Failed to load tags: ' + err.message + '</p>';
        return;
    }

    // Calculate tag counts from ALL bookmarks
    const tagCounts = {};
    allBookmarks.forEach(b => {
        if (b.tags) {
            b.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    const allTags = Object.keys(tagCounts);
    console.log('Dashboard Settings: Found', allTags.length, 'unique tags from', allBookmarks.length, 'bookmarks');

    function renderTagList() {
        // Filter by search term
        const searchTerm = tagSearch ? tagSearch.value.toLowerCase() : '';
        let filteredTags = allTags.filter(t => t.toLowerCase().includes(searchTerm));

        // Sort
        const sortMode = tagSort ? tagSort.value : 'count_desc';
        filteredTags.sort((a, b) => {
            if (sortMode === 'count_desc') return tagCounts[b] - tagCounts[a];
            if (sortMode === 'count_asc') return tagCounts[a] - tagCounts[b];
            return a.localeCompare(b);
        });

        if (allTags.length === 0) {
            tagsList.innerHTML = '<p style="color:var(--text-tertiary);padding:1rem;text-align:center">No tags found. Import bookmarks with tags or add tags to your bookmarks.</p>';
        } else if (filteredTags.length === 0) {
            tagsList.innerHTML = '<p style="color:var(--text-tertiary)">No matching tags.</p>';
        } else {
            tagsList.innerHTML = filteredTags.map(tag => {
                const checked = dashboardConfig.tags.includes(tag) ? 'checked' : '';
                const count = tagCounts[tag];
                return `
                    <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer;padding:4px" title="${count} bookmarks">
                        <input type="checkbox" value="${tag.replace(/"/g, '&quot;')}" ${checked}>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(tag)} <span style="color:var(--text-tertiary);font-size:0.8em">(${count})</span></span>
                    </label>
                `;
            }).join('');

            // Attach listeners to checkboxes
            tagsList.querySelectorAll('input').forEach(chk => {
                chk.onchange = () => {
                    if (chk.checked) {
                        if (!dashboardConfig.tags.includes(chk.value)) {
                            dashboardConfig.tags.push(chk.value);
                        }
                    } else {
                        dashboardConfig.tags = dashboardConfig.tags.filter(t => t !== chk.value);
                    }
                    saveConfig();
                };
            });
        }
    }

    function saveConfig() {
        dashboardConfig.mode = modeSelect.value;
        if (sortSelect) dashboardConfig.bookmarkSort = sortSelect.value;
        saveSettings({
            dashboard_mode: dashboardConfig.mode,
            dashboard_sort: dashboardConfig.bookmarkSort
        });
        if (currentView === 'dashboard') renderDashboard();
    }

    // Attach listeners
    modeSelect.onchange = saveConfig;
    if (sortSelect) sortSelect.onchange = saveConfig;
    if (tagSearch) tagSearch.oninput = renderTagList;
    if (tagSort) tagSort.onchange = renderTagList;

    // Initial render
    renderTagList();
}

// Modals
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

// ... (other functions)

// Hook up listener
// (This line must be replaced in the Event Listener section)

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    resetForms();
}

function resetForms() {
    document.getElementById('bookmark-form').reset();
    document.getElementById('folder-form').reset();
    document.getElementById('bookmark-id').value = '';
    document.getElementById('folder-id').value = '';
    document.getElementById('bookmark-modal-title').textContent = 'Add Bookmark';
    document.getElementById('folder-modal-title').textContent = 'New Folder';
    document.querySelectorAll('.color-option').forEach((opt, i) => {
        opt.classList.toggle('active', i === 0);
    });
    document.getElementById('folder-color').value = '#6366f1';
    if (tagSuggestions) tagSuggestions.innerHTML = '';
}

// Import/Export
async function importHtml(file) {
    const html = await file.text();
    try {
        const result = await api('/import/html', {
            method: 'POST',
            body: JSON.stringify({ html })
        });
        await loadBookmarks();
        showToast(`Imported ${result.imported} bookmarks!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function exportJson() {
    try {
        const data = await api('/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'anchormarks-bookmarks.json');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function exportHtml() {
    try {
        const headers = {};
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const response = await fetch(`${API_BASE}/export?format=html`, { headers });

        if (response.status === 401) {
            logout();
            throw new Error('Session expired');
        }

        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        downloadBlob(blob, 'anchormarks-bookmarks.html');
        showToast('Export successful', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// API Key
async function regenerateApiKey() {
    if (!confirm('Regenerate API key? Old keys will stop working.')) return;

    try {
        const data = await api('/auth/regenerate-key', { method: 'POST' });
        currentUser.api_key = data.api_key;
        document.getElementById('api-key-value').textContent = data.api_key;
        showToast('API key regenerated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function copyApiKey() {
    navigator.clipboard.writeText(currentUser.api_key);
    showToast('API key copied!', 'success');
}

// Reset Bookmarks
async function resetBookmarks() {
    if (!confirm('Reset all bookmarks? This will delete all your bookmarks and folders, and restore the example bookmarks. This cannot be undone!')) return;

    try {
        const data = await api('/settings/reset-bookmarks', { method: 'POST' });
        currentFolder = null;
        currentView = 'all';
        viewTitle.textContent = 'Bookmarks';
        await Promise.all([loadFolders(), loadBookmarks()]);
        updateActiveNav();
        closeModals();
        showToast(`Bookmarks reset! ${data.bookmarks_created} example bookmarks created.`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Toast
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    // Don't auto-hide error toasts, let user dismiss them
    if (type !== 'error') {
        setTimeout(() => toast.classList.add('hidden'), 3000);
    } else {
        // Add click to dismiss for error toasts
        toast.onclick = () => toast.classList.add('hidden');
    }
}

// Helpers
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function parseTagInput(value) {
    if (!value) return [];
    return value.split(',').map(t => t.trim()).filter(Boolean);
}

function addTagToInput(tag) {
    if (!bookmarkTagsInput) return;
    const current = new Set(parseTagInput(bookmarkTagsInput.value));
    current.add(tag);
    bookmarkTagsInput.value = Array.from(current).join(', ');
}

function renderTagSuggestions(list) {
    if (!tagSuggestions) return;
    if (!list || list.length === 0) {
        tagSuggestions.innerHTML = '<span class="text-tertiary" style="font-size:0.85rem;">No suggestions yet</span>';
        return;
    }

    tagSuggestions.innerHTML = list.map(tag => `
        <button type="button" class="tag-suggestion" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `).join('');

    tagSuggestions.querySelectorAll('.tag-suggestion').forEach(btn => {
        btn.addEventListener('click', () => addTagToInput(btn.dataset.tag));
    });
}

let tagSuggestTimeout;
async function showTagSuggestions(url) {
    if (!tagSuggestions || !url) return;
    clearTimeout(tagSuggestTimeout);
    tagSuggestTimeout = setTimeout(async () => {
        try {
            // Try to get smart suggestions first
            if (typeof showSmartTagSuggestions === 'function') {
                await showSmartTagSuggestions(url);
            } else {
                // Fallback to basic suggestions if smart module not loaded
                const suggestions = await api(`/tags/suggest?url=${encodeURIComponent(url)}`);
                renderTagSuggestions(suggestions);
            }
        } catch (err) {
            renderTagSuggestions([]);
        }
    }, 300);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Auth tabs
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loginForm.classList.toggle('hidden', tab.dataset.tab !== 'login');
            registerForm.classList.toggle('hidden', tab.dataset.tab !== 'register');
        });
    });

    // Auth forms
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        login(email, password);
    });

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        register(email, password);
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => {
            currentView = item.dataset.view;
            currentFolder = null;
            displayedCount = BOOKMARKS_PER_PAGE; // Reset lazy loading
            updateActiveNav();
            loadBookmarks();
            viewTitle.textContent = item.querySelector('span').textContent;
        });
    });

    // Search
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        displayedCount = BOOKMARKS_PER_PAGE; // Reset lazy loading on search
        searchTimeout = setTimeout(renderBookmarks, 300);
    });

    // Shortcuts
    document.addEventListener('keydown', (e) => {
        const key = (e.key || '').toLowerCase();
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
        const modifier = e.ctrlKey || e.metaKey;

        // Escape key - close modals/palettes
        if (key === 'escape') {
            if (commandPaletteOpen) {
                e.preventDefault();
                closeCommandPalette();
            } else if (bulkMode) {
                clearSelections();
            }
            return;
        }

        // Ctrl+N / Cmd+N: Add new bookmark
        if (modifier && key === 'n') {
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || 
                document.activeElement.id === 'command-palette-input') {
                e.preventDefault();
                openModal('bookmark-modal');
            }
        }

        // Ctrl+F / Cmd+F: Focus search (prevent browser default)
        if (modifier && key === 'f') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            searchInput.focus();
        }

        // Ctrl+K / Cmd+K: Focus search (alternative)
        if (modifier && key === 'k' && !commandPaletteOpen) {
            e.preventDefault();
            searchInput.focus();
        }

        // Ctrl+Shift+P / Cmd+Shift+P: Open command palette
        if (modifier && e.shiftKey && key === 'p') {
            e.preventDefault();
            if (commandPaletteOpen) {
                closeCommandPalette();
            } else {
                openCommandPalette();
            }
        }

        // Ctrl+A / Cmd+A: Select all bookmarks (when not in input)
        if (modifier && key === 'a') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            selectAllBookmarks();
        }

        // Ctrl+1 to Ctrl+9 / Cmd+1 to Cmd+9: Navigate to folders/collections
        if (modifier && !e.shiftKey && key >= '1' && key <= '9') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            const folderIndex = parseInt(key) - 1;
            navigateToFolderByIndex(folderIndex);
        }

        // Ctrl+Shift+D: Go to dashboard
        if (modifier && e.shiftKey && key === 'd') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            currentView = 'dashboard';
            currentFolder = null;
            updateActiveNav();
            viewTitle.textContent = 'Dashboard';
            loadBookmarks();
        }

        // Ctrl+Shift+F: Go to favorites
        if (modifier && e.shiftKey && key === 'f') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            currentView = 'favorites';
            currentFolder = null;
            updateActiveNav();
            viewTitle.textContent = 'Favorites';
            loadBookmarks();
        }

        // Ctrl+Shift+A: Go to all bookmarks
        if (modifier && e.shiftKey && key === 'a') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            currentView = 'all';
            currentFolder = null;
            updateActiveNav();
            viewTitle.textContent = 'Bookmarks';
            loadBookmarks();
        }

        // Shift+/ or >: Open shortcuts help popup
        if ((e.shiftKey && key === '/') || key === '>') {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            e.preventDefault();
            openShortcutsPopup();
        }

        // Command palette navigation (arrow keys and enter)
        if (commandPaletteOpen) {
            if (key === 'arrowdown') {
                e.preventDefault();
                updateCommandPaletteActive(1);
            } else if (key === 'arrowup') {
                e.preventDefault();
                updateCommandPaletteActive(-1);
            } else if (key === 'enter') {
                e.preventDefault();
                runActiveCommand();
            }
        }
    });

    // Filter Sidebar (with null checks for optional elements)
    const filterBtn = document.getElementById('filter-btn');
    const closeFilterBtn = document.getElementById('close-filter-sidebar');
    const filterSort = document.getElementById('filter-sort');
    const filterTagSort = document.getElementById('filter-tag-sort');
    const filterTagSearch = document.getElementById('filter-tag-search');

    if (filterBtn) filterBtn.addEventListener('click', toggleFilterSidebar);
    if (closeFilterBtn) closeFilterBtn.addEventListener('click', toggleFilterSidebar);

    if (filterSort) {
        filterSort.addEventListener('change', (e) => {
            filterConfig.sort = e.target.value;
            renderBookmarks();
        });
    }

    if (filterTagSort) {
        filterTagSort.addEventListener('change', (e) => {
            filterConfig.tagSort = e.target.value;
            renderFilterSidebar();
        });
    }

    if (filterTagSearch) {
        filterTagSearch.addEventListener('input', () => {
            renderFilterSidebar();
        });
    }

    // Bulk actions
    document.getElementById('bulk-delete-btn')?.addEventListener('click', bulkDelete);
    document.getElementById('bulk-favorite-btn')?.addEventListener('click', bulkFavorite);
    document.getElementById('bulk-move-btn')?.addEventListener('click', bulkMove);
    document.getElementById('bulk-clear-btn')?.addEventListener('click', clearSelections);
    document.getElementById('bulk-tag-btn')?.addEventListener('click', bulkAddTags);
    document.getElementById('bulk-untag-btn')?.addEventListener('click', bulkRemoveTags);
    if (bulkMoveSelect) populateBulkMoveSelect();

    // Command palette
    if (commandPaletteInput) {
        commandPaletteInput.addEventListener('input', () => renderCommandPaletteList(commandPaletteInput.value));
        commandPaletteInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateCommandPaletteActive(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                updateCommandPaletteActive(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                runActiveCommand();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeCommandPalette();
            }
        });
    }

    // Shortcuts popup
    const shortcutsPopup = document.getElementById('shortcuts-popup');
    const shortcutsPopupClose = document.getElementById('shortcuts-popup-close');
    
    if (shortcutsPopupClose) {
        shortcutsPopupClose.addEventListener('click', closeShortcutsPopup);
    }
    
    if (shortcutsPopup) {
        shortcutsPopup.addEventListener('click', (e) => {
            // Close when clicking on backdrop
            if (e.target === shortcutsPopup) {
                closeShortcutsPopup();
            }
        });
    }

    if (commandPaletteList) {
        commandPaletteList.addEventListener('click', (e) => {
            const item = e.target.closest('.command-item');
            if (!item) return;
            const idx = parseInt(item.dataset.index, 10);
            if (!Number.isNaN(idx)) {
                commandPaletteActiveIndex = idx;
                runActiveCommand();
            }
        });
    }

    commandPalette?.addEventListener('click', (e) => {
        if (e.target.classList.contains('command-palette-backdrop')) {
            closeCommandPalette();
        }
    });

    // Add Bookmark
    document.getElementById('add-bookmark-btn')?.addEventListener('click', () => openModal('bookmark-modal'));
    document.getElementById('sidebar-add-bookmark-btn')?.addEventListener('click', () => openModal('bookmark-modal'));
    document.getElementById('empty-add-btn')?.addEventListener('click', () => openModal('bookmark-modal'));

    // Bookmark Form
    document.getElementById('bookmark-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('bookmark-id').value;
        const data = {
            url: document.getElementById('bookmark-url').value,
            title: document.getElementById('bookmark-title').value || undefined,
            description: document.getElementById('bookmark-description').value || undefined,
            folder_id: document.getElementById('bookmark-folder').value || undefined,
            tags: document.getElementById('bookmark-tags').value || undefined
        };

        if (id) {
            updateBookmark(id, data);
        } else {
            createBookmark(data);
        }
    });

    // Fetch Metadata Button
    document.getElementById('fetch-metadata-btn')?.addEventListener('click', async () => {
        const urlInput = document.getElementById('bookmark-url');
        const url = urlInput.value.trim();
        
        if (!url) {
            showToast('Please enter a URL first', 'warning');
            urlInput.focus();
            return;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            showToast('Please enter a valid URL', 'error');
            return;
        }

        const btn = document.getElementById('fetch-metadata-btn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            Fetching...
        `;

        try {
            const metadata = await api('/bookmarks/fetch-metadata', {
                method: 'POST',
                body: JSON.stringify({ url })
            });

            // Only populate title if it's empty
            const titleInput = document.getElementById('bookmark-title');
            if (!titleInput.value && metadata.title) {
                titleInput.value = metadata.title;
            }

            // Only populate description if it's empty
            const descInput = document.getElementById('bookmark-description');
            if (!descInput.value && metadata.description) {
                descInput.value = metadata.description;
            }

            showToast('Metadata fetched successfully!', 'success');
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
            showToast(err.message || 'Failed to fetch metadata', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    });

    // Add Folder
    document.getElementById('add-folder-btn').addEventListener('click', () => {
        updateFolderParentSelect();
        openModal('folder-modal');
    });

    // Folder Form
    document.getElementById('folder-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('folder-id').value;
        const data = {
            name: document.getElementById('folder-name').value,
            color: document.getElementById('folder-color').value,
            parent_id: document.getElementById('folder-parent').value || null
        };

        if (id) {
            updateFolder(id, data);
        } else {
            createFolder(data);
        }
    });

    // Color Picker
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            document.getElementById('folder-color').value = opt.dataset.color;
        });
    });

    // View Mode
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => setViewMode(btn.dataset.viewMode));
    });

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => {
        loadDashboardSettings();
        openModal('settings-modal');
    });

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`settings-${tab.dataset.settingsTab}`).classList.add('active');

            // Load dashboard settings when Dashboard tab is clicked
            if (tab.dataset.settingsTab === 'dashboard') {
                loadDashboardSettings();
            }
            if (tab.dataset.settingsTab === 'tags') {
                loadTagStats();
            }
        });
    });

    document.getElementById('dark-mode-toggle').addEventListener('change', toggleTheme);
    document.getElementById('hide-favicons-toggle')?.addEventListener('change', toggleFavicons);
    document.getElementById('toggle-sidebar-btn')?.addEventListener('click', toggleSidebar);
    applyFaviconSetting();

    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('copy-api-key').addEventListener('click', copyApiKey);
    document.getElementById('regenerate-api-key').addEventListener('click', regenerateApiKey);
    document.getElementById('reset-bookmarks-btn').addEventListener('click', resetBookmarks);

    // Import/Export
    document.getElementById('import-html-btn').addEventListener('click', () => {
        document.getElementById('import-html-file').click();
    });
    document.getElementById('import-html-file').addEventListener('change', (e) => {
        if (e.target.files[0]) importHtml(e.target.files[0]);
    });
    document.getElementById('export-json-btn').addEventListener('click', exportJson);
    document.getElementById('export-html-btn').addEventListener('click', exportHtml);

    // Tag rename / merge
    tagRenameBtn?.addEventListener('click', async () => {
        const from = tagRenameFrom?.value.trim();
        const to = tagRenameTo?.value.trim();
        if (!from || !to) {
            showToast('Enter both tags to rename', 'error');
            return;
        }
        if (!confirm(`Rename tag "${from}" to "${to}"?`)) return;
        try {
            await renameTagAcross(from, to);
        } catch (err) {
            showToast(err.message || 'Rename failed', 'error');
        }
    });

    tagRenameUndoBtn?.addEventListener('click', async () => {
        if (!lastTagRenameAction) return;
        const { from, to } = lastTagRenameAction;
        if (!confirm(`Undo rename ${from} → ${to}?`)) return;
        try {
            await renameTagAcross(to, from);
            lastTagRenameAction = null;
            updateTagRenameUndoButton();
            showToast('Undo complete', 'success');
        } catch (err) {
            showToast(err.message || 'Undo failed', 'error');
        }
    });

    // Sidebar tag search
    document.getElementById('sidebar-tag-search')?.addEventListener('input', (e) => {
        filterSidebarTags(e.target.value);
    });

    document.getElementById('tags-show-more')?.addEventListener('click', showAllTags);
    document.getElementById('folders-show-more')?.addEventListener('click', showAllFolders);

    // Section Toggles
    document.querySelectorAll('[data-toggle-section]').forEach(header => {
        header.addEventListener('click', () => {
            toggleSection(header.dataset.toggleSection);
        });
    });

    // Add Folder Button stopPropagation
    document.getElementById('add-folder-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Tag suggestions from URL
    if (bookmarkUrlInput) {
        bookmarkUrlInput.addEventListener('input', (e) => {
            showTagSuggestions(e.target.value);
        });
    }

    // Modal Close
    document.querySelectorAll('.modal-backdrop, .modal-close, .modal-cancel').forEach(el => {
        el.addEventListener('click', closeModals);
    });

    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => e.stopPropagation());
    });

    // Global Event Delegation for Dynamic Content (CSP Fix)
    document.body.addEventListener('input', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        if (target.dataset.action === 'filter-dashboard-bookmarks') {
            filterDashboardBookmarks(target.value);
        }
    });

    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;
        const tag = target.dataset.tag;
        const modal = target.dataset.modalTarget;

        switch (action) {
            case 'clear-filters': clearAllFilters(); break;
            case 'open-modal': if (modal) openModal(modal); break;
            case 'switch-dashboard-tab': if (id) switchDashboardTab(id); break;
            case 'track-click': if (id) trackClick(id); break;
            case 'open-bookmark':
                e.stopPropagation();
                if (target.dataset.url) {
                    window.open(target.dataset.url, '_blank');
                    const bookmarkId = bookmarks.find(b => b.url === target.dataset.url)?.id;
                    if (bookmarkId) trackClick(bookmarkId);
                }
                break;
            case 'copy-link':
                e.stopPropagation();
                if (target.dataset.url) {
                    navigator.clipboard.writeText(target.dataset.url).then(() => {
                        showToast('Link copied to clipboard', 'success');
                    }).catch(() => {
                        showToast('Failed to copy link', 'error');
                    });
                }
                break;
            case 'toggle-favorite':
                e.stopPropagation();
                if (id) toggleFavorite(id);
                break;
            case 'edit-bookmark':
                e.stopPropagation();
                if (id) editBookmark(id);
                break;
            case 'delete-bookmark':
                e.stopPropagation();
                if (id) deleteBookmark(id);
                break;
            case 'filter-by-tag':
                e.stopPropagation();
                if (tag) filterByTag(tag);
                break;
            case 'edit-folder':
                e.stopPropagation();
                if (id) editFolder(id);
                break;
            case 'delete-folder':
                e.stopPropagation();
                if (id) deleteFolder(id);
                break;
            case 'remove-tag-filter': if (tag) removeTagFilter(tag); break;
            case 'clear-search': clearSearch(); break;
            case 'toggle-filter-tag': 
                e.stopPropagation();
                if (tag) toggleFilterTag(tag); 
                break;
            case 'toggle-tag-mode':
                e.stopPropagation();
                toggleTagMode();
                break;
            case 'load-dashboard-settings': loadDashboardSettings(); break;
            case 'skip-tour': skipTour(); break;
            case 'bulk-select-all': selectAllBookmarks(); break;
            case 'bulk-unselect-all': clearSelections(); break;
        }
    });

    // Tour next button
    document.getElementById('tour-next-btn')?.addEventListener('click', nextTourStep);

    // Initialize smart organization features
    if (typeof initSmartOrganization === 'function') {
        initSmartOrganization();
    }
});

