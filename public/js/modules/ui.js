/**
 * AnchorMarks - UI Module
 * Handles modals, toasts, and general UI functions
 */

import * as state from './state.js';
import { escapeHtml, parseTagInput } from './utils.js';

// DOM Element references (initialized on DOMContentLoaded)
export const dom = {
    authScreen: null,
    mainApp: null,
    loginForm: null,
    registerForm: null,
    authTabs: null,
    bookmarksContainer: null,
    emptyState: null,
    searchInput: null,
    viewTitle: null,
    viewCount: null,
    bulkBar: null,
    bulkMoveSelect: null,
    bulkCount: null,
    commandPalette: null,
    commandPaletteInput: null,
    commandPaletteList: null,
    bookmarkUrlInput: null,
    bookmarkTagsInput: null,
    tagSuggestions: null,
    tagStatsList: null,
    tagRenameFrom: null,
    tagRenameTo: null,
    tagRenameBtn: null,
    tagRenameUndoBtn: null
};

// Initialize DOM references
export function initDom() {
    dom.authScreen = document.getElementById('auth-screen');
    dom.mainApp = document.getElementById('main-app');
    dom.loginForm = document.getElementById('login-form');
    dom.registerForm = document.getElementById('register-form');
    dom.authTabs = document.querySelectorAll('.auth-tab');
    dom.bookmarksContainer = document.getElementById('bookmarks-container');
    dom.emptyState = document.getElementById('empty-state');
    dom.searchInput = document.getElementById('search-input');
    dom.viewTitle = document.getElementById('view-title');
    dom.viewCount = document.getElementById('view-count');
    dom.bulkBar = document.getElementById('bulk-bar');
    dom.bulkMoveSelect = document.getElementById('bulk-move-select');
    dom.bulkCount = document.getElementById('bulk-count');
    dom.commandPalette = document.getElementById('command-palette');
    dom.commandPaletteInput = document.getElementById('command-palette-input');
    dom.commandPaletteList = document.getElementById('command-palette-list');
    dom.bookmarkUrlInput = document.getElementById('bookmark-url');
    dom.bookmarkTagsInput = document.getElementById('bookmark-tags');
    dom.tagSuggestions = document.getElementById('tag-suggestions');
    dom.tagStatsList = document.getElementById('tag-stats-list');
    dom.tagRenameFrom = document.getElementById('tag-rename-from');
    dom.tagRenameTo = document.getElementById('tag-rename-to');
    dom.tagRenameBtn = document.getElementById('tag-rename-btn');
    dom.tagRenameUndoBtn = document.getElementById('tag-rename-undo-btn');
}

// Show toast notification
export function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Open modal
export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('hidden');
}

// Close all modals
export function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    resetForms();
}

// Reset forms
export function resetForms() {
    const bookmarkForm = document.getElementById('bookmark-form');
    const folderForm = document.getElementById('folder-form');

    if (bookmarkForm) bookmarkForm.reset();
    if (folderForm) folderForm.reset();

    const bookmarkId = document.getElementById('bookmark-id');
    const folderId = document.getElementById('folder-id');
    if (bookmarkId) bookmarkId.value = '';
    if (folderId) folderId.value = '';

    const bookmarkModalTitle = document.getElementById('bookmark-modal-title');
    const folderModalTitle = document.getElementById('folder-modal-title');
    if (bookmarkModalTitle) bookmarkModalTitle.textContent = 'Add Bookmark';
    if (folderModalTitle) folderModalTitle.textContent = 'New Folder';

    document.querySelectorAll('.color-option').forEach((opt, i) => {
        opt.classList.toggle('active', i === 0);
    });

    const folderColor = document.getElementById('folder-color');
    if (folderColor) folderColor.value = '#6366f1';

    if (dom.tagSuggestions) dom.tagSuggestions.innerHTML = '';
}

// Add tag to input field
export function addTagToInput(tag) {
    if (!dom.bookmarkTagsInput) return;
    const current = new Set(parseTagInput(dom.bookmarkTagsInput.value));
    current.add(tag);
    dom.bookmarkTagsInput.value = Array.from(current).join(', ');
}

// Update active navigation
export function updateActiveNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (state.currentView === 'folder') {
        document.querySelector(`.folder-item[data-folder="${state.currentFolder}"]`)?.classList.add('active');
    } else if (state.currentView === 'dashboard') {
        document.querySelector(`.nav-item[data-view="dashboard"]`)?.classList.add('active');
    } else {
        document.querySelector(`.nav-item[data-view="${state.currentView}"]`)?.classList.add('active');
    }
}

// Update counts display
export function updateCounts() {
    const allCount = state.bookmarks.length;
    const favCount = state.bookmarks.filter(b => b.is_favorite).length;
    const viewCountVal = state.renderedBookmarks.length;

    const allCountEl = document.getElementById('all-count');
    const favCountEl = document.getElementById('fav-count');
    const viewCountEl = document.getElementById('view-count');

    if (allCountEl) allCountEl.textContent = allCount;
    if (favCountEl) favCountEl.textContent = favCount;
    if (viewCountEl) viewCountEl.textContent = `${viewCountVal} bookmark${viewCountVal !== 1 ? 's' : ''}`;

    updateStats();
}

// Update stats
export function updateStats() {
    const statBookmarks = document.getElementById('stat-bookmarks');
    const statFolders = document.getElementById('stat-folders');
    const statTags = document.getElementById('stat-tags');
    const foldersCount = document.getElementById('folders-count');

    if (statBookmarks) statBookmarks.textContent = state.renderedBookmarks.length;
    if (statFolders) statFolders.textContent = state.folders.length;
    if (foldersCount) foldersCount.textContent = state.folders.length;

    const tagSet = new Set();
    state.renderedBookmarks.forEach(b => {
        if (b.tags) {
            b.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagSet.add(tag);
            });
        }
    });
    if (statTags) statTags.textContent = tagSet.size;
}

// Get contextual empty state message
export function getEmptyStateMessage() {
    if (state.currentView === 'favorites') {
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

    if (state.filterConfig.tags.length > 0) {
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

    const searchValue = dom.searchInput?.value.trim();
    if (searchValue) {
        return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <h3>No results found</h3>
                <p>No bookmarks match "${escapeHtml(searchValue)}".<br>Try a different search term.</p>
            </div>
        `;
    }

    if (state.currentView === 'folder' && state.currentFolder) {
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

// Update bulk selection UI
export function updateBulkUI() {
    if (!dom.bulkBar) return;
    if (state.selectedBookmarks.size === 0) {
        dom.bulkBar.classList.add('hidden');
        return;
    }
    dom.bulkBar.classList.remove('hidden');
    if (dom.bulkCount) dom.bulkCount.textContent = `${state.selectedBookmarks.size} selected`;
}

export default {
    dom,
    initDom,
    showToast,
    openModal,
    closeModals,
    resetForms,
    addTagToInput,
    updateActiveNav,
    updateCounts,
    updateStats,
    getEmptyStateMessage,
    updateBulkUI
};