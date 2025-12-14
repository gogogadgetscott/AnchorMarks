/**
 * AnchorMarks - Bookmarks Module
 * Handles bookmark CRUD operations and rendering
 */

import * as state from './state.js';
import { api } from './api.js';
import { escapeHtml, getHostname, parseTagInput } from './utils.js';
import { dom, showToast, closeModals, openModal, updateCounts, getEmptyStateMessage, updateBulkUI, updateActiveNav } from './ui.js';

// Note: renderDashboard, renderSidebarTags, and checkWelcomeTour are loaded dynamically
// to avoid circular dependencies

// Load bookmarks from server
export async function loadBookmarks() {
    try {
        let endpoint = '/bookmarks';
        const params = new URLSearchParams();

        if (state.currentView === 'favorites') params.append('favorites', 'true');
        if (state.currentFolder) params.append('folder_id', state.currentFolder);

        const sortOption = state.filterConfig.sort || state.dashboardConfig.bookmarkSort || 'recently_added';
        params.append('sort', sortOption);

        const query = params.toString();
        if (query) endpoint += `?${query}`;

        const bookmarks = await api(endpoint);
        state.setBookmarks(bookmarks);

        if (state.currentView === 'dashboard') {
            // Dynamic import to avoid circular dependency
            const { renderDashboard } = await import('./dashboard.js');
            renderDashboard();
        } else {
            renderBookmarks();
        }
        updateCounts();

        // Dynamic imports to avoid circular dependencies
        const { renderSidebarTags } = await import('./search.js');
        const { checkWelcomeTour } = await import('./tour.js');
        renderSidebarTags();
        checkWelcomeTour();
    } catch (err) {
        showToast('Failed to load bookmarks', 'error');
    }
}

// Render bookmarks list
export function renderBookmarks() {
    const container = dom.bookmarksContainer || document.getElementById('bookmarks-container');
    const emptyState = dom.emptyState || document.getElementById('empty-state');
    const searchInput = dom.searchInput || document.getElementById('search-input');

    if (!container) return;

    // Show view toggle
    document.querySelector('.view-toggle')?.classList.remove('hidden');

    // Set container class based on view mode
    const classMap = {
        'grid': 'bookmarks-grid',
        'list': 'bookmarks-list',
        'compact': 'bookmarks-compact'
    };
    container.className = classMap[state.viewMode] || 'bookmarks-grid';

    const searchTerm = searchInput?.value.toLowerCase() || '';
    let filtered = [...state.bookmarks];

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(b =>
            b.title.toLowerCase().includes(searchTerm) ||
            b.url.toLowerCase().includes(searchTerm) ||
            (b.tags && b.tags.toLowerCase().includes(searchTerm))
        );
    }

    // Apply view-specific filters
    if (state.currentView === 'recent') {
        filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    } else {
        // Apply tag filter
        if (state.filterConfig.tags.length > 0) {
            filtered = filtered.filter(b => {
                if (!b.tags) return false;
                const bTags = b.tags.split(',').map(t => t.trim());
                if (state.filterConfig.tagMode === 'AND') {
                    return state.filterConfig.tags.every(t => bTags.includes(t));
                } else {
                    return state.filterConfig.tags.some(t => bTags.includes(t));
                }
            });
        }

        // Apply sort
        const sort = state.filterConfig.sort;
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
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'recently_added':
                case 'created_desc':
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });
    }

    state.setRenderedBookmarks(filtered);

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.innerHTML = getEmptyStateMessage();
            emptyState.classList.remove('hidden');
        }
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Lazy loading
    const toRender = filtered.slice(0, state.displayedCount);
    const hasMore = filtered.length > state.displayedCount;

    container.innerHTML = toRender.map((b, i) => createBookmarkCard(b, i)).join('');

    if (hasMore) {
        container.innerHTML += `
            <div id="load-more-sentinel" class="load-more-sentinel">
                <div class="loading-spinner"></div>
                <span>Loading more bookmarks...</span>
            </div>
        `;
        setupInfiniteScroll(filtered);
    }

    attachBookmarkCardListeners();
    updateBulkUI();
    updateCounts();
}

// Create bookmark card HTML
export function createBookmarkCard(bookmark, index) {
    const tags = bookmark.tags ? bookmark.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    const hostname = getHostname(bookmark.url);
    const isSelected = state.selectedBookmarks.has(bookmark.id);

    return `
    <div class="bookmark-card ${isSelected ? 'selected' : ''}" data-id="${bookmark.id}" data-index="${index}">
      <label class="bookmark-select">
        <input type="checkbox" ${isSelected ? 'checked' : ''}>
      </label>
      <div class="bookmark-header">
        <div class="bookmark-favicon">
          ${!state.hideFavicons && bookmark.favicon
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
    </div>
    `;
}

// Attach event listeners to bookmark cards
export function attachBookmarkCardListeners() {
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    container.querySelectorAll('.bookmark-card').forEach(card => {
        if (card.dataset.listenerAttached) return;
        card.dataset.listenerAttached = 'true';

        card.addEventListener('click', (e) => {
            const id = card.dataset.id;
            const index = parseInt(card.dataset.index, 10);

            if (e.target.closest('.bookmark-select')) return;
            if (e.target.closest('.bookmark-actions')) return;
            if (e.target.closest('.bookmark-tags')) return;

            if (state.bulkMode) {
                toggleBookmarkSelection(id, index, e.shiftKey, true);
                return;
            }

            const bookmark = state.bookmarks.find(b => b.id === id);
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
                toggleBookmarkSelection(id, index, e.shiftKey, true);
            });
        }
    });
}

// Setup infinite scroll
function setupInfiniteScroll(allFiltered) {
    const sentinel = document.getElementById('load-more-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !state.isLoadingMore) {
            loadMoreBookmarks(allFiltered);
        }
    }, { rootMargin: '100px' });

    observer.observe(sentinel);
}

// Load more bookmarks for infinite scroll
function loadMoreBookmarks(allFiltered) {
    if (state.isLoadingMore) return;
    if (state.displayedCount >= allFiltered.length) return;

    state.setIsLoadingMore(true);

    setTimeout(() => {
        const prevCount = state.displayedCount;
        state.setDisplayedCount(Math.min(state.displayedCount + state.BOOKMARKS_PER_PAGE, allFiltered.length));

        const newBookmarks = allFiltered.slice(prevCount, state.displayedCount);
        const sentinel = document.getElementById('load-more-sentinel');

        const newHtml = newBookmarks.map((b, i) => createBookmarkCard(b, prevCount + i)).join('');
        if (sentinel) {
            sentinel.insertAdjacentHTML('beforebegin', newHtml);
        }

        attachBookmarkCardListeners();

        if (state.displayedCount >= allFiltered.length && sentinel) {
            sentinel.remove();
        }

        state.setIsLoadingMore(false);
    }, 100);
}

// Toggle bookmark selection
export function toggleBookmarkSelection(id, index, isShift, isMulti) {
    if (isShift && state.lastSelectedIndex !== null && state.renderedBookmarks.length > 0) {
        const start = Math.min(state.lastSelectedIndex, index);
        const end = Math.max(state.lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
            state.selectedBookmarks.add(state.renderedBookmarks[i].id);
        }
    } else {
        if (state.selectedBookmarks.has(id)) {
            state.selectedBookmarks.delete(id);
        } else {
            if (!isMulti) state.selectedBookmarks.clear();
            state.selectedBookmarks.add(id);
        }
        state.setLastSelectedIndex(index);
    }

    state.setBulkMode(state.selectedBookmarks.size > 0);
    updateBulkUI();
    renderBookmarks();
}

// Clear all selections
export function clearSelections() {
    state.selectedBookmarks.clear();
    state.setBulkMode(false);
    state.setLastSelectedIndex(null);
    updateBulkUI();
    renderBookmarks();
}

// Select all bookmarks
export function selectAllBookmarks() {
    state.renderedBookmarks.forEach(b => state.selectedBookmarks.add(b.id));
    if (state.selectedBookmarks.size > 0) {
        state.setBulkMode(true);
    }
    updateBulkUI();
    renderBookmarks();
}

// Create bookmark
export async function createBookmark(data) {
    try {
        const bookmark = await api('/bookmarks', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        state.bookmarks.unshift(bookmark);
        renderBookmarks();
        updateCounts();
        closeModals();
        showToast('Bookmark added!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Update bookmark
export async function updateBookmark(id, data) {
    try {
        const bookmark = await api(`/bookmarks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        const index = state.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) state.bookmarks[index] = bookmark;
        renderBookmarks();
        updateCounts();
        closeModals();
        showToast('Bookmark updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete bookmark
export async function deleteBookmark(id) {
    if (!confirm('Delete this bookmark?')) return;

    try {
        await api(`/bookmarks/${id}`, { method: 'DELETE' });
        state.setBookmarks(state.bookmarks.filter(b => b.id !== id));
        renderBookmarks();
        updateCounts();
        showToast('Bookmark deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Toggle favorite
export async function toggleFavorite(id) {
    const bookmark = state.bookmarks.find(b => b.id === id);
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

// Track click
export async function trackClick(id) {
    try {
        await api(`/bookmarks/${id}/click`, { method: 'POST' });
    } catch (err) {
        // Silent fail
    }
}

// Edit bookmark (populate form)
export function editBookmark(id) {
    const bookmark = state.bookmarks.find(b => b.id === id);
    if (!bookmark) return;

    document.getElementById('bookmark-modal-title').textContent = 'Edit Bookmark';
    document.getElementById('bookmark-id').value = id;
    document.getElementById('bookmark-url').value = bookmark.url;
    document.getElementById('bookmark-title').value = bookmark.title;
    document.getElementById('bookmark-description').value = bookmark.description || '';
    document.getElementById('bookmark-folder').value = bookmark.folder_id || '';
    document.getElementById('bookmark-tags').value = bookmark.tags || '';

    openModal('bookmark-modal');
}

// Filter by tag
export function filterByTag(tag) {
    const searchInput = document.getElementById('search-input');
    const viewTitle = document.getElementById('view-title');

    if (searchInput) searchInput.value = tag;
    state.setCurrentFolder(null);
    state.setCurrentView('all');
    if (viewTitle) viewTitle.textContent = `Tag: ${tag}`;

    updateActiveNav();
    renderBookmarks();
}

// Sort bookmarks helper
export function sortBookmarks(list) {
    const sort = state.dashboardConfig.bookmarkSort || 'recently_added';
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
                return new Date(a.created_at) - new Date(b.created_at);
            case 'recently_added':
            case 'created_desc':
            default:
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });
}

export default {
    loadBookmarks,
    renderBookmarks,
    createBookmarkCard,
    attachBookmarkCardListeners,
    toggleBookmarkSelection,
    clearSelections,
    selectAllBookmarks,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    toggleFavorite,
    trackClick,
    editBookmark,
    filterByTag,
    sortBookmarks
};
