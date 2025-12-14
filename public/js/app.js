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
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        csrfToken = data.csrfToken;
        currentUser = data.user;
        showMainApp();
        showToast('Welcome back!', 'success');
    } catch (err) {
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
    setViewMode(state.viewMode);
}

// Dashboard Settings Loader
async function loadDashboardSettings() {
    const modeSelect = document.getElementById('dashboard-mode-select');
    const sortSelect = document.getElementById('dashboard-bookmark-sort');
    const tagsList = document.getElementById('dashboard-tags-list');
    const tagSearch = document.getElementById('dashboard-tag-search');
    const tagSort = document.getElementById('dashboard-tag-sort');

    if (!modeSelect || !tagsList) return;

    modeSelect.value = state.dashboardConfig.mode;
    if (sortSelect) sortSelect.value = state.dashboardConfig.bookmarkSort || 'recently_added';

    tagsList.innerHTML = '<p style="color:var(--text-tertiary);padding:1rem;text-align:center">Loading tags...</p>';

    let allBookmarks = [];
    try {
        allBookmarks = await api('/bookmarks');
    } catch (err) {
        tagsList.innerHTML = '<p style="color:var(--danger);padding:1rem">Failed to load tags</p>';
        return;
    }

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

    function renderTagList() {
        const searchTerm = tagSearch ? tagSearch.value.toLowerCase() : '';
        let filteredTags = allTags.filter(t => t.toLowerCase().includes(searchTerm));

        const sortMode = tagSort ? tagSort.value : 'count_desc';
        filteredTags.sort((a, b) => {
            if (sortMode === 'count_desc') return tagCounts[b] - tagCounts[a];
            if (sortMode === 'count_asc') return tagCounts[a] - tagCounts[b];
            return a.localeCompare(b);
        });

        if (allTags.length === 0) {
            tagsList.innerHTML = '<p style="color:var(--text-tertiary);padding:1rem;text-align:center">No tags found.</p>';
        } else if (filteredTags.length === 0) {
            tagsList.innerHTML = '<p style="color:var(--text-tertiary)">No matching tags.</p>';
        } else {
            tagsList.innerHTML = filteredTags.map(tag => {
                const checked = state.dashboardConfig.tags.includes(tag) ? 'checked' : '';
                const count = tagCounts[tag];
                return `
                    <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer;padding:4px" title="${count} bookmarks">
                        <input type="checkbox" value="${tag.replace(/"/g, '&quot;')}" ${checked}>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(tag)} <span style="color:var(--text-tertiary);font-size:0.8em">(${count})</span></span>
                    </label>
                `;
            }).join('');

            tagsList.querySelectorAll('input').forEach(chk => {
                chk.onchange = () => {
                    if (chk.checked) {
                        if (!state.dashboardConfig.tags.includes(chk.value)) {
                            state.dashboardConfig.tags.push(chk.value);
                        }
                    } else {
                        state.dashboardConfig.tags = state.dashboardConfig.tags.filter(t => t !== chk.value);
                    }
                    saveConfig();
                };
            });
        }
    }

    function saveConfig() {
        state.dashboardConfig.mode = modeSelect.value;
        if (sortSelect) state.dashboardConfig.bookmarkSort = sortSelect.value;
        saveSettings({
            dashboard_mode: state.dashboardConfig.mode,
            dashboard_sort: state.dashboardConfig.bookmarkSort
        });
        if (state.currentView === 'dashboard') renderDashboard();
    }

    modeSelect.onchange = saveConfig;
    if (sortSelect) sortSelect.onchange = saveConfig;
    if (tagSearch) tagSearch.oninput = renderTagList;
    if (tagSort) tagSort.onchange = renderTagList;

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

    setTimeout(() => toast.classList.add('hidden'), 3000);
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
    const tagSuggestions = document.getElementById('tag-suggestions');
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

// Show all folders
function showAllFolders() {
    const btn = document.getElementById('folders-show-more');
    if (btn) btn.classList.add('hidden');
    renderFolders(true);
}

// ============================================================
// Event Listeners
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize DOM references
    initDom();

    // Check authentication
    const isAuthed = await checkAuth();
    if (isAuthed) {
        await loadSettings();
        showMainApp();
        await initializeApp();
    }

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('login-form')?.classList.toggle('hidden', tab.dataset.tab !== 'login');
            document.getElementById('register-form')?.classList.toggle('hidden', tab.dataset.tab !== 'register');
        });
    });

    // Auth forms
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (await login(email, password)) {
            await loadSettings();
            await initializeApp();
        }
    });

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        if (await register(email, password)) {
            await loadSettings();
            await initializeApp();
        }
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => {
            state.setCurrentView(item.dataset.view);
            state.setCurrentFolder(null);
            state.setDisplayedCount(state.BOOKMARKS_PER_PAGE);
            updateActiveNav();
            loadBookmarks();
            const viewTitle = document.getElementById('view-title');
            if (viewTitle) viewTitle.textContent = item.querySelector('span')?.textContent || '';
        });
    });

    // Search
    let searchTimeout;
    document.getElementById('search-input')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        state.setDisplayedCount(state.BOOKMARKS_PER_PAGE);
        searchTimeout = setTimeout(renderBookmarks, 300);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Filter controls
    document.getElementById('filter-sort')?.addEventListener('change', (e) => {
        state.filterConfig.sort = e.target.value;
        renderBookmarks();
    });

    document.getElementById('filter-tag-sort')?.addEventListener('change', () => {
        renderActiveFilters();
    });

    document.getElementById('filter-tag-search')?.addEventListener('input', () => {
        renderActiveFilters();
    });

    // Bulk actions
    document.getElementById('bulk-delete-btn')?.addEventListener('click', bulkDelete);
    document.getElementById('bulk-favorite-btn')?.addEventListener('click', bulkFavorite);
    document.getElementById('bulk-move-btn')?.addEventListener('click', bulkMove);
    document.getElementById('bulk-clear-btn')?.addEventListener('click', clearSelections);
    document.getElementById('bulk-tag-btn')?.addEventListener('click', bulkAddTags);
    document.getElementById('bulk-untag-btn')?.addEventListener('click', bulkRemoveTags);

    // Command palette
    const commandPaletteInput = document.getElementById('command-palette-input');
    commandPaletteInput?.addEventListener('input', () => renderCommandPaletteList(commandPaletteInput.value));
    commandPaletteInput?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); updateCommandPaletteActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); updateCommandPaletteActive(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); runActiveCommand(); }
        else if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
    });

    document.getElementById('command-palette-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.command-item');
        if (!item) return;
        const idx = parseInt(item.dataset.index, 10);
        if (!Number.isNaN(idx)) {
            state.setCommandPaletteActiveIndex(idx);
            runActiveCommand();
        }
    });

    document.getElementById('command-palette')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('command-palette-backdrop')) {
            closeCommandPalette();
        }
    });

    // Shortcuts popup
    document.getElementById('shortcuts-popup-close')?.addEventListener('click', closeShortcutsPopup);
    document.getElementById('shortcuts-popup')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeShortcutsPopup();
    });

    // Add Bookmark buttons
    document.getElementById('add-bookmark-btn')?.addEventListener('click', () => openModal('bookmark-modal'));
    document.getElementById('sidebar-add-bookmark-btn')?.addEventListener('click', () => openModal('bookmark-modal'));
    document.getElementById('empty-add-btn')?.addEventListener('click', () => openModal('bookmark-modal'));

    // Bookmark Form
    document.getElementById('bookmark-form')?.addEventListener('submit', (e) => {
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
        const url = urlInput?.value.trim();

        if (!url) {
            showToast('Please enter a URL first', 'warning');
            urlInput?.focus();
            return;
        }

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

            const titleInput = document.getElementById('bookmark-title');
            if (!titleInput.value && metadata.title) {
                titleInput.value = metadata.title;
            }

            const descInput = document.getElementById('bookmark-description');
            if (!descInput.value && metadata.description) {
                descInput.value = metadata.description;
            }

            showToast('Metadata fetched successfully!', 'success');
        } catch (err) {
            showToast(err.message || 'Failed to fetch metadata', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    });

    // Add Folder
    document.getElementById('add-folder-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        updateFolderParentSelect();
        openModal('folder-modal');
    });

    // Folder Form
    document.getElementById('folder-form')?.addEventListener('submit', (e) => {
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
    document.getElementById('settings-btn')?.addEventListener('click', () => {
        loadDashboardSettings();
        openModal('settings-modal');
    });

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`settings-${tab.dataset.settingsTab}`)?.classList.add('active');

            if (tab.dataset.settingsTab === 'dashboard') loadDashboardSettings();
            if (tab.dataset.settingsTab === 'tags') loadTagStats();
        });
    });

    document.getElementById('dark-mode-toggle')?.addEventListener('change', toggleTheme);
    document.getElementById('hide-favicons-toggle')?.addEventListener('change', toggleFavicons);
    document.getElementById('toggle-sidebar-btn')?.addEventListener('click', toggleSidebar);
    applyFaviconSetting();

    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('copy-api-key')?.addEventListener('click', copyApiKey);
    document.getElementById('regenerate-api-key')?.addEventListener('click', regenerateApiKey);
    document.getElementById('reset-bookmarks-btn')?.addEventListener('click', resetBookmarks);

    // Import/Export
    document.getElementById('import-html-btn')?.addEventListener('click', () => {
        document.getElementById('import-html-file')?.click();
    });
    document.getElementById('import-html-file')?.addEventListener('change', (e) => {
        if (e.target.files[0]) importHtml(e.target.files[0]);
    });
    document.getElementById('export-json-btn')?.addEventListener('click', exportJson);
    document.getElementById('export-html-btn')?.addEventListener('click', exportHtml);

    // Tag rename
    document.getElementById('tag-rename-btn')?.addEventListener('click', async () => {
        const from = document.getElementById('tag-rename-from')?.value.trim();
        const to = document.getElementById('tag-rename-to')?.value.trim();
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

    document.getElementById('tag-rename-undo-btn')?.addEventListener('click', async () => {
        if (!state.lastTagRenameAction) return;
        const { from, to } = state.lastTagRenameAction;
        if (!confirm(`Undo rename ${from} → ${to}?`)) return;
        try {
            await renameTagAcross(to, from);
            state.setLastTagRenameAction(null);
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

    // Tag suggestions from URL
    document.getElementById('bookmark-url')?.addEventListener('input', (e) => {
        showTagSuggestions(e.target.value);
    });

    // Modal Close
    document.querySelectorAll('.modal-backdrop, .modal-close, .modal-cancel').forEach(el => {
        el.addEventListener('click', closeModals);
    });

    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => e.stopPropagation());
    });

    // Global Event Delegation
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
            case 'track-click': if (id) trackClick(id); break;
            case 'open-bookmark':
                e.stopPropagation();
                if (target.dataset.url) {
                    window.open(target.dataset.url, '_blank');
                    const bookmarkId = state.bookmarks.find(b => b.url === target.dataset.url)?.id;
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
            case 'toggle-favorite': e.stopPropagation(); if (id) toggleFavorite(id); break;
            case 'edit-bookmark': e.stopPropagation(); if (id) editBookmark(id); break;
            case 'delete-bookmark': e.stopPropagation(); if (id) deleteBookmark(id); break;
            case 'filter-by-tag': e.stopPropagation(); if (tag) filterByTag(tag); break;
            case 'edit-folder': e.stopPropagation(); if (id) editFolder(id); break;
            case 'delete-folder': e.stopPropagation(); if (id) deleteFolder(id); break;
            case 'remove-tag-filter': if (tag) removeTagFilter(tag); break;
            case 'clear-search': clearSearch(); break;
            case 'toggle-filter-tag': e.stopPropagation(); if (tag) toggleFilterTag(tag); break;
            case 'toggle-tag-mode': e.stopPropagation(); toggleTagMode(); break;
            case 'load-dashboard-settings': loadDashboardSettings(); break;
            case 'skip-tour': skipTour(); break;
            case 'bulk-select-all': selectAllBookmarks(); break;
            case 'bulk-unselect-all': clearSelections(); break;
        }
    });

    // Tour next button
    document.getElementById('tour-next-btn')?.addEventListener('click', nextTourStep);

    // Initialize smart organization features
    SmartOrg.init();
});

// Keyboard handler
function handleKeyboard(e) {
    const key = (e.key || '').toLowerCase();
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const modifier = e.ctrlKey || e.metaKey;

    // Escape key
    if (key === 'escape') {
        if (state.commandPaletteOpen) {
            e.preventDefault();
            closeCommandPalette();
        } else if (state.bulkMode) {
            clearSelections();
        }
        return;
    }

    // Ctrl+N: Add new bookmark
    if (modifier && key === 'n') {
        if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) ||
            document.activeElement.id === 'command-palette-input') {
            e.preventDefault();
            openModal('bookmark-modal');
        }
    }

    // Ctrl+F: Focus search
    if (modifier && key === 'f') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        document.getElementById('search-input')?.focus();
    }

    // Ctrl+K: Focus search
    if (modifier && key === 'k' && !state.commandPaletteOpen) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
    }

    // Ctrl+Shift+P: Command palette
    if (modifier && e.shiftKey && key === 'p') {
        e.preventDefault();
        if (state.commandPaletteOpen) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
    }

    // Ctrl+A: Select all
    if (modifier && key === 'a') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        selectAllBookmarks();
    }

    // Ctrl+1 to 9: Navigate to folders
    if (modifier && !e.shiftKey && key >= '1' && key <= '9') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        navigateToFolderByIndex(parseInt(key) - 1);
    }

    // Ctrl+Shift+D: Dashboard
    if (modifier && e.shiftKey && key === 'd') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        state.setCurrentView('dashboard');
        state.setCurrentFolder(null);
        updateActiveNav();
        document.getElementById('view-title').textContent = 'Dashboard';
        loadBookmarks();
    }

    // Ctrl+Shift+F: Favorites
    if (modifier && e.shiftKey && key === 'f') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        state.setCurrentView('favorites');
        state.setCurrentFolder(null);
        updateActiveNav();
        document.getElementById('view-title').textContent = 'Favorites';
        loadBookmarks();
    }

    // Ctrl+Shift+A: All bookmarks
    if (modifier && e.shiftKey && key === 'a') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        state.setCurrentView('all');
        state.setCurrentFolder(null);
        updateActiveNav();
        document.getElementById('view-title').textContent = 'Bookmarks';
        loadBookmarks();
    }

    // Shift+/: Shortcuts help
    if ((e.shiftKey && key === '/') || key === '>') {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        e.preventDefault();
        openShortcutsPopup();
    }

    // Command palette navigation
    if (state.commandPaletteOpen) {
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
}

// ============================================================
// Global API Export (for external modules and debugging)
// ============================================================

window.AnchorMarks = {
    // API
    api: api,

    // State getters/setters
    get bookmarks() { return state.bookmarks; },
    set bookmarks(val) { state.setBookmarks(val); },
    get folders() { return state.folders; },
    set folders(val) { state.setFolders(val); },
    get currentView() { return state.currentView; },
    set currentView(val) { state.setCurrentView(val); },
    get currentFolder() { return state.currentFolder; },
    set currentFolder(val) { state.setCurrentFolder(val); },
    get filterConfig() { return state.filterConfig; },
    get selectedBookmarks() { return state.selectedBookmarks; },
    get viewMode() { return state.viewMode; },
    get hideFavicons() { return state.hideFavicons; },
    get dashboardConfig() { return state.dashboardConfig; },

    // UI Functions
    showToast,
    openModal,
    closeModals,

    // Utility Functions
    escapeHtml,
    getHostname,
    parseTagInput,
    addTagToInput,

    // Data Functions
    loadBookmarks,
    loadFolders,
    renderBookmarks,
    renderDashboard,
    renderFolders,

    // Settings
    saveSettings,
    loadSettings
};

// Make filter functions available globally
window.toggleFilterTag = toggleFilterTag;
window.toggleTagMode = toggleTagMode;
window.filterDashboardBookmarks = filterDashboardBookmarks;
