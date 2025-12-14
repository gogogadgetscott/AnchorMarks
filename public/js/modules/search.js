/**
 * AnchorMarks - Search Module
 * Handles search, filtering, tags sidebar, and tag management
 */

import * as state from './state.js';
import { api } from './api.js';
import { escapeHtml, parseTagInput } from './utils.js';
import { showToast, updateActiveNav, dom } from './ui.js';
import { renderBookmarks, loadBookmarks } from './bookmarks.js';

// Render sidebar tags
export function renderSidebarTags() {
    const container = document.getElementById('sidebar-tags-list');
    const countBadge = document.getElementById('tags-count');
    const showMoreBtn = document.getElementById('tags-show-more');
    if (!container) return;

    // Calculate tag counts
    const tagCounts = {};
    state.bookmarks.forEach(b => {
        if (b.tags) {
            b.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    // Build tags array
    const allTags = Object.keys(tagCounts)
        .map(name => ({ name, count: tagCounts[name] }));

    // Sort based on filterConfig.tagSort
    const sortMode = state.filterConfig.tagSort || 'count_desc';
    allTags.sort((a, b) => {
        switch (sortMode) {
            case 'count_asc':
                return a.count - b.count;
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'count_desc':
            default:
                return b.count - a.count;
        }
    });

    state.setAllSidebarTags(allTags);

    if (countBadge) countBadge.textContent = allTags.length;

    // Show "show more" if more than 15 tags
    if (showMoreBtn) {
        if (allTags.length > 15 && !state.showingAllTags) {
            showMoreBtn.classList.remove('hidden');
            showMoreBtn.textContent = `Show all ${allTags.length} tags`;
        } else {
            showMoreBtn.classList.add('hidden');
        }
    }

    // Render tags list
    const tagsToShow = state.showingAllTags ? allTags.slice(0, 100) : allTags.slice(0, 15);
    renderTagsList(tagsToShow);
}

// Filter tag on sidebar click
export function sidebarFilterTag(tag) {
    state.setCurrentView('all');
    state.setCurrentFolder(null);

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    // Toggle tag selection
    const idx = state.filterConfig.tags.indexOf(tag);
    if (idx === -1) {
        state.filterConfig.tags.push(tag);
    } else {
        state.filterConfig.tags.splice(idx, 1);
    }

    // Update view title
    const viewTitle = document.getElementById('view-title');
    if (viewTitle) {
        if (state.filterConfig.tags.length === 0) {
            viewTitle.textContent = 'Bookmarks';
        } else {
            viewTitle.textContent = `Tags: ${state.filterConfig.tags.join(', ')}`;
        }
    }

    updateActiveNav();
    renderActiveFilters();
    renderBookmarks();
    renderSidebarTags();
}

// Filter sidebar tags by search
export function filterSidebarTags(searchTerm) {
    const container = document.getElementById('sidebar-tags-list');
    if (!container) return;

    const filtered = state.allSidebarTags.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    renderTagsList(filtered.slice(0, state.showingAllTags ? 100 : 15));
}

// Show all tags
export function showAllTags() {
    state.setShowingAllTags(true);
    const btn = document.getElementById('tags-show-more');
    if (btn) btn.classList.add('hidden');
    renderTagsList(state.allSidebarTags.slice(0, 100));
}

// Render tags list
export function renderTagsList(tags) {
    const container = document.getElementById('sidebar-tags-list');
    if (!container) return;

    if (tags.length === 0) {
        container.innerHTML = '<div style="padding: 0.5rem; font-size: 0.75rem; color: var(--text-tertiary);">No tags found</div>';
        return;
    }

    container.innerHTML = '';
    tags.forEach(tag => {
        const div = document.createElement('div');
        div.className = `sidebar-tag-item ${state.filterConfig.tags.includes(tag.name) ? 'active' : ''}`;
        div.draggable = true;
        div.style.cursor = 'grab';
        div.dataset.tagName = tag.name;
        div.dataset.tagCount = tag.count;
        div.innerHTML = `
            <span class="tag-name">${escapeHtml(tag.name)}</span>
            <span class="tag-count">${tag.count}</span>
        `;

        div.addEventListener('click', (e) => {
            if (e.defaultPrevented) return;
            sidebarFilterTag(tag.name);
        });

        // Setup drag for dashboard
        div.addEventListener('dragstart', (e) => {
            state.setDraggedSidebarItem({
                type: 'tag',
                id: tag.name,
                name: tag.name,
                color: '#10b981'
            });
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', tag.name);
        });

        div.addEventListener('dragend', () => {
            state.setDraggedSidebarItem(null);
        });

        container.appendChild(div);
    });
}

// Clear all filters
export function clearAllFilters() {
    state.filterConfig.tags = [];
    state.filterConfig.sort = 'recently_added';

    const searchInput = document.getElementById('search-input');
    const viewTitle = document.getElementById('view-title');

    if (searchInput) searchInput.value = '';
    state.setCurrentView('all');
    state.setCurrentFolder(null);
    if (viewTitle) viewTitle.textContent = 'Bookmarks';

    updateActiveNav();
    renderActiveFilters();
    loadBookmarks();
    renderSidebarTags();
}

// Render active filters
export function renderActiveFilters() {
    const section = document.getElementById('active-filters-section');
    const chipsContainer = document.getElementById('active-filters-chips');
    if (!section || !chipsContainer) return;

    const searchInput = document.getElementById('search-input');

    // Check if we have a folder selected
    const currentFolder = state.currentFolder;
    const folderName = currentFolder ? state.folders.find(f => f.id === currentFolder)?.name : null;

    const hasFilters = state.filterConfig.tags.length > 0 ||
        (searchInput?.value.trim()) ||
        currentFolder;

    if (!hasFilters) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    let html = '';

    // Folder chip
    if (currentFolder && folderName) {
        html += `
            <div class="filter-chip folder-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>${escapeHtml(folderName)}</span>
                <button data-action="clear-folder-filter" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }

    // Tag mode button
    if (state.filterConfig.tags.length > 0) {
        html += `
            <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;">
                <button id="filter-tag-mode-btn" data-action="toggle-tag-mode" class="tag-mode-btn ${state.filterConfig.tagMode === 'AND' ? 'and-mode' : 'or-mode'}">
                    Match: ${state.filterConfig.tagMode}
                </button>
                <span style="font-size: 12px; color: var(--text-muted);">${state.filterConfig.tags.length} tag${state.filterConfig.tags.length !== 1 ? 's' : ''} selected</span>
            </div>
        `;
    }

    // Tag chips
    state.filterConfig.tags.forEach(tag => {
        html += `
            <div class="filter-chip">
            <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span>${escapeHtml(tag)}</span>
                <button data-action="remove-tag-filter" data-tag="${escapeHtml(tag)}" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    });

    // Search chip
    if (searchInput?.value.trim()) {
        html += `
            <div class="filter-chip tag-chip">
                <span>Search: ${escapeHtml(searchInput.value)}</span>
                <button data-action="clear-search" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }

    chipsContainer.innerHTML = html;
}

// Toggle filter tag
export function toggleFilterTag(tag) {
    if (state.filterConfig.tags.includes(tag)) {
        state.filterConfig.tags = state.filterConfig.tags.filter(t => t !== tag);
    } else {
        state.filterConfig.tags.push(tag);
    }

    state.setCurrentView('all');
    state.setCurrentFolder(null);

    const searchInput = document.getElementById('search-input');
    const viewTitle = document.getElementById('view-title');

    if (searchInput) searchInput.value = '';

    if (viewTitle) {
        if (state.filterConfig.tags.length === 0) {
            viewTitle.textContent = 'Bookmarks';
        } else {
            viewTitle.textContent = `Tags: ${state.filterConfig.tags.join(', ')} (${state.filterConfig.tagMode})`;
        }
    }

    updateActiveNav();
    renderActiveFilters();
    renderSidebarTags();
    renderBookmarks();
}

// Toggle tag mode (AND/OR)
export function toggleTagMode() {
    state.filterConfig.tagMode = state.filterConfig.tagMode === 'OR' ? 'AND' : 'OR';

    const viewTitle = document.getElementById('view-title');
    if (viewTitle && state.filterConfig.tags.length > 0) {
        viewTitle.textContent = `Tags: ${state.filterConfig.tags.join(', ')} (${state.filterConfig.tagMode})`;
    }

    renderActiveFilters();
    renderBookmarks();
}

// Remove tag filter
export function removeTagFilter(tag) {
    state.filterConfig.tags = state.filterConfig.tags.filter(t => t !== tag);
    renderActiveFilters();
    renderBookmarks();
    renderSidebarTags();

    if (state.filterConfig.tags.length === 0) {
        const viewTitle = document.getElementById('view-title');
        if (viewTitle) viewTitle.textContent = 'Bookmarks';
    }
}

// Clear search
export function clearSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    renderBookmarks();
    renderActiveFilters();
}

// Rename tag across all bookmarks
export async function renameTagAcross(from, to) {
    if (!from || !to) return;

    await api('/tags/rename', {
        method: 'POST',
        body: JSON.stringify({ from, to })
    });

    state.setBookmarks(state.bookmarks.map(b => {
        if (!b.tags) return b;
        const tags = parseTagInput(b.tags).map(t => (t === from ? to : t));
        const merged = Array.from(new Set(tags)).join(', ');
        return { ...b, tags: merged };
    }));

    renderBookmarks();
    renderSidebarTags();
    await loadTagStats();
    state.setLastTagRenameAction({ from, to });
    updateTagRenameUndoButton();
    showToast(`Renamed ${from} → ${to}`, 'success');
}

// Load tag stats
export async function loadTagStats() {
    const tagStatsList = document.getElementById('tag-stats-list');
    if (!tagStatsList) return;

    try {
        const tags = await api('/tags');
        if (!tags || tags.length === 0) {
            tagStatsList.innerHTML = '<div class="text-tertiary" style="font-size:0.9rem;">No tags yet</div>';
            updateTagRenameUndoButton();
            return;
        }

        tagStatsList.innerHTML = tags.map(t => {
            const path = t.parent ? `<div class="tag-path">${escapeHtml(t.parent)}</div>` : '';
            return `<div class="tag-stat-item"><div>${escapeHtml(t.name)}${path}</div><span class="badge">${t.count}</span></div>`;
        }).join('');
        updateTagRenameUndoButton();
    } catch (err) {
        tagStatsList.innerHTML = '<div class="text-tertiary" style="font-size:0.9rem;">Failed to load tags</div>';
        updateTagRenameUndoButton();
    }
}

// Update tag rename undo button
export function updateTagRenameUndoButton() {
    const btn = document.getElementById('tag-rename-undo-btn');
    if (!btn) return;

    if (state.lastTagRenameAction) {
        btn.disabled = false;
        btn.textContent = `Undo ${state.lastTagRenameAction.from} → ${state.lastTagRenameAction.to}`;
    } else {
        btn.disabled = true;
        btn.textContent = 'Undo last rename';
    }
}

export default {
    renderSidebarTags,
    sidebarFilterTag,
    filterSidebarTags,
    showAllTags,
    renderTagsList,
    clearAllFilters,
    renderActiveFilters,
    toggleFilterTag,
    toggleTagMode,
    removeTagFilter,
    clearSearch,
    renameTagAcross,
    loadTagStats,
    updateTagRenameUndoButton
};
