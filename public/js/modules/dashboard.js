/**
 * AnchorMarks - Dashboard Module
 * Handles dashboard rendering and widget management
 */

import * as state from './state.js';
import { escapeHtml } from './utils.js';
import { showToast, dom, updateCounts, openModal, closeModals } from './ui.js';
import { saveSettings } from './settings.js';
import { api } from './api.js';

// Grid size for snap-to-grid feature
const GRID_SIZE = 20;

// Snap value to grid
function snapToGrid(value) {
    if (!state.snapToGrid) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// ... (existing helper functions)

// Init dashboard views UI
export async function initDashboardViews() {
    const headerActions = document.querySelector('.header-right');
    if (!headerActions) return;

    // Remove bookmark views button if it exists
    document.getElementById('bookmark-views-btn')?.remove();

    // Check if Views button already exists
    if (!document.getElementById('dashboard-views-btn')) {
        const btn = document.createElement('button');
        btn.id = 'dashboard-views-btn';
        btn.className = 'btn btn-secondary';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Views
        `;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showViewsMenu();
        });

        headerActions.insertBefore(btn, headerActions.firstChild);
    }

    // Add snap-to-grid toggle if it doesn't exist
    if (!document.getElementById('snap-to-grid-toggle')) {
        const snapBtn = document.createElement('button');
        snapBtn.id = 'snap-to-grid-toggle';
        snapBtn.className = `btn btn-secondary ${state.snapToGrid ? 'active' : ''}`;
        snapBtn.title = 'Snap to Grid';
        snapBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
            </svg>
        `;
        snapBtn.addEventListener('click', async () => {
            state.setSnapToGrid(!state.snapToGrid);
            snapBtn.classList.toggle('active', state.snapToGrid);
            await saveSettings({ snap_to_grid: state.snapToGrid });
            showToast(`Snap to grid ${state.snapToGrid ? 'enabled' : 'disabled'}`, 'success');
        });

        headerActions.insertBefore(snapBtn, headerActions.firstChild);
    }

    // Initial load
    await loadViews();
}

// Show views menu (simple dropdown or modal)
async function showViewsMenu() {
    // Remove existing dropdown if any
    document.getElementById('views-dropdown')?.remove();

    const views = await loadViews();

    const dropdown = document.createElement('div');
    dropdown.id = 'views-dropdown';
    dropdown.className = 'dropdown-menu';
    dropdown.style.cssText = `
        position: absolute;
        top: 3rem;
        right: 1rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 50;
        min-width: 200px;
        padding: 0.5rem;
    `;

    let html = `
        <div style="font-weight:600;padding:0.5rem;border-bottom:1px solid var(--border-color);margin-bottom:0.5rem">
            Dashboard Views
        </div>
        <div class="views-list" style="max-height:200px;overflow-y:auto">
    `;

    if (views.length === 0) {
        html += `<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center">No saved views</div>`;
    } else {
        views.forEach(view => {
            html += `
                <div class="dropdown-item view-item" data-view-id="${view.id}" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;cursor:pointer;border-radius:4px">
                    <span class="view-name" style="flex:1">${escapeHtml(view.name)}</span>
                    <button class="btn-icon small text-danger delete-view-btn" data-view-id="${view.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
        });
    }

    html += `
        </div>
        <div style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:0.5rem">
            <button class="btn btn-primary btn-sm btn-full" id="save-view-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Current View
            </button>
        </div>
    `;

    dropdown.innerHTML = html;
    document.body.appendChild(dropdown);

    // Attach event listeners to view items
    dropdown.querySelectorAll('.view-item').forEach(item => {
        const viewId = item.dataset.viewId;
        const nameSpan = item.querySelector('.view-name');
        const deleteBtn = item.querySelector('.delete-view-btn');

        // Click on view name to restore
        if (nameSpan) {
            nameSpan.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await restoreView(viewId);
            });
        }

        // Click on delete button
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await deleteView(viewId);
            });
        }
    });

    // Attach event listener to save button
    const saveBtn = dropdown.querySelector('#save-view-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await saveCurrentView();
        });
    }

    // Global click to close
    setTimeout(() => {
        document.addEventListener('click', closeViewsDropdown);
    }, 0);
}

function closeViewsDropdown(e) {
    const dropdown = document.getElementById('views-dropdown');
    if (dropdown && !dropdown.contains(e.target) && e.target.id !== 'dashboard-views-btn') {
        dropdown.remove();
        document.removeEventListener('click', closeViewsDropdown);
    }
}

// Save View
async function saveCurrentView() {
    console.log('saveCurrentView called');
    const name = prompt('Enter a name for this view:');
    if (!name) return;

    try {
        console.log('Saving view:', name);
        const config = {
            dashboard_mode: state.dashboardConfig.mode,
            dashboard_tags: state.dashboardConfig.tags,
            dashboard_sort: state.dashboardConfig.bookmarkSort,
            widget_order: state.widgetOrder,
            dashboard_widgets: state.dashboardWidgets,
            include_child_bookmarks: state.includeChildBookmarks ? 1 : 0
        };

        const view = await api('/dashboard/views', {
            method: 'POST',
            body: JSON.stringify({ name, config })
        });

        showToast('View saved!', 'success');
        document.getElementById('views-dropdown')?.remove();

        // Prompt to create bookmark shortcut
        if (confirm('Create a bookmark shortcut for this view?')) {
            const { createBookmark } = await import('./bookmarks.js');
            await createBookmark({
                title: name,
                url: `view:${view.id}`,
                description: 'Dashboard View Shortcut',
                tags: 'dashboard-views'
            });
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Load Views
async function loadViews() {
    try {
        return await api('/dashboard/views');
    } catch {
        return [];
    }
}

// Delete View
async function deleteView(id) {
    if (!confirm('Delete this view?')) return;
    try {
        await api(`/dashboard/views/${id}`, { method: 'DELETE' });
        showToast('View deleted', 'success');
        // Refresh dropdown if open
        document.getElementById('views-dropdown')?.remove();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Restore View
async function restoreView(id) {
    try {
        await api(`/dashboard/views/${id}/restore`, { method: 'POST' });
        showToast('View restored!', 'success');
        document.getElementById('views-dropdown')?.remove();

        // Reload settings to get updated dashboard config
        const { loadSettings } = await import('./settings.js');
        await loadSettings();

        // Ensure current view is set to dashboard
        state.setCurrentView('dashboard');
        await saveSettings({ current_view: 'dashboard' });

        // Re-render dashboard with new settings
        renderDashboard();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Make functions global for inline onclick handlers
window.saveCurrentView = saveCurrentView;
window.deleteView = deleteView;
window.restoreView = restoreView;



// sortBookmarks is defined locally to avoid circular dependency with bookmarks.js
function sortBookmarks(list) {
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

// Render dashboard
export function renderDashboard() {
    const container = dom.bookmarksContainer || document.getElementById('bookmarks-container');
    const emptyState = dom.emptyState || document.getElementById('empty-state');
    const bulkBar = dom.bulkBar || document.getElementById('bulk-bar');

    if (!container) return;

    // Hide view toggle in dashboard
    document.querySelector('.view-toggle')?.classList.add('hidden');
    bulkBar?.classList.add('hidden');

    container.className = 'dashboard-freeform';
    container.innerHTML = ''; // Clear existing content
    if (emptyState) emptyState.classList.add('hidden');

    // Initialize dashboard views UI
    initDashboardViews();
    const btn = document.getElementById('dashboard-views-btn');
    if (btn) btn.classList.remove('hidden');

    const dashboardHtml = `
        <div class="dashboard-freeform-container" id="dashboard-drop-zone">
            <div class="dashboard-help-text">
                ${state.dashboardWidgets.length === 0 ?
            '<p>Drag folders or tags from the sidebar to create widgets</p>' :
            ''}
            </div>
            <div class="dashboard-widgets-container" id="dashboard-widgets-freeform">
                ${renderFreeformWidgets()}
            </div>
        </div>
    `;

    container.innerHTML = dashboardHtml;
    initDashboardDragDrop();
}

// Render freeform widgets
function renderFreeformWidgets() {
    let html = '';

    state.dashboardWidgets.forEach((widget, index) => {
        const widgetData = getWidgetData(widget);
        if (!widgetData) return;

        const { name, color, bookmarks: widgetBookmarks, count } = widgetData;
        const sortedBookmarks = sortBookmarks(widgetBookmarks);
        const widgetColor = widget.color || color;

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
                ${widget.type === 'folder' ?
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>` :
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>`
            }
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
                                ${!state.hideFavicons && b.favicon ? `<img src="${b.favicon}" alt="">` :
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

// Get widget data
function getWidgetData(widget) {
    if (widget.type === 'folder') {
        const folder = state.folders.find(f => f.id === widget.id);
        if (!folder) return null;

        let folderBookmarks;
        if (state.includeChildBookmarks) {
            // Dynamic import if needed, or assume folders module loaded.
            // But to be safe and avoid circular dep issues with simple imports, we can implement simple recursion here 
            // or stick to the plan. Folders module is likely loaded.
            // Let's implement simple recursion here to be safe as it's small.
            const getAllIds = (fid) => {
                const ids = [fid];
                state.folders.filter(f => f.parent_id === fid).forEach(c => ids.push(...getAllIds(c.id)));
                return ids;
            };
            const allIds = getAllIds(folder.id);
            folderBookmarks = state.bookmarks.filter(b => allIds.includes(b.folder_id));
        } else {
            folderBookmarks = state.bookmarks.filter(b => b.folder_id === folder.id);
        }

        return {
            name: folder.name,
            color: folder.color || '#6366f1',
            bookmarks: folderBookmarks,
            count: folderBookmarks.length
        };
    } else if (widget.type === 'tag') {
        const tagBookmarks = state.bookmarks.filter(b =>
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

// Initialize dashboard drag and drop
export function initDashboardDragDrop() {
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

        const rect = dropZone.getBoundingClientRect();
        const x = e.clientX - rect.left + dropZone.scrollLeft;
        const y = e.clientY - rect.top + dropZone.scrollTop;

        if (state.draggedSidebarItem) {
            const { type, id } = state.draggedSidebarItem;
            addDashboardWidget(type, id, x, y);
            state.setDraggedSidebarItem(null);
        }
    });

    // Setup widget drag and resize
    document.querySelectorAll('.dashboard-widget-freeform').forEach(widget => {
        const header = widget.querySelector('.widget-header');
        const resizeHandle = widget.querySelector('.widget-resize-handle');

        // Drag to move
        header?.addEventListener('mousedown', (e) => {
            if (e.target.closest('.widget-remove') || e.target.closest('.widget-color-btn')) return;

            state.setIsDraggingWidget(true);
            state.setDraggedWidget(widget);
            state.setDragStartPos({ x: e.clientX, y: e.clientY });
            state.setWidgetStartPos({
                x: parseInt(widget.style.left) || 0,
                y: parseInt(widget.style.top) || 0
            });
            widget.classList.add('dragging');
            e.preventDefault();
        });

        // Resize handle
        resizeHandle?.addEventListener('mousedown', (e) => {
            state.setIsResizing(true);
            state.setResizingWidget(widget);
            state.setDragStartPos({ x: e.clientX, y: e.clientY });
            state.setResizeStartSize({
                w: parseInt(widget.style.width) || 320,
                h: parseInt(widget.style.height) || 400
            });
            widget.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Global mouse handlers
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

// Handle mouse move for drag/resize
function handleMouseMove(e) {
    if (state.isDraggingWidget && state.draggedWidget) {
        const deltaX = e.clientX - state.dragStartPos.x;
        const deltaY = e.clientY - state.dragStartPos.y;

        const newX = state.widgetStartPos.x + deltaX;
        const newY = state.widgetStartPos.y + deltaY;

        // Apply snap-to-grid
        state.draggedWidget.style.left = `${snapToGrid(newX)}px`;
        state.draggedWidget.style.top = `${snapToGrid(newY)}px`;
    } else if (state.isResizing && state.resizingWidget) {
        const deltaX = e.clientX - state.dragStartPos.x;
        const deltaY = e.clientY - state.dragStartPos.y;

        const newWidth = Math.max(150, state.resizeStartSize.w + deltaX);
        const newHeight = Math.max(100, state.resizeStartSize.h + deltaY);

        // Apply snap-to-grid
        state.resizingWidget.style.width = `${snapToGrid(newWidth)}px`;
        state.resizingWidget.style.height = `${snapToGrid(newHeight)}px`;
    }
}

// Handle mouse up for drag/resize
function handleMouseUp(e) {
    if (state.isDraggingWidget && state.draggedWidget) {
        state.draggedWidget.classList.remove('dragging');

        const index = parseInt(state.draggedWidget.dataset.widgetIndex);
        if (state.dashboardWidgets[index]) {
            state.dashboardWidgets[index].x = parseInt(state.draggedWidget.style.left) || 0;
            state.dashboardWidgets[index].y = parseInt(state.draggedWidget.style.top) || 0;
            saveDashboardWidgets();
        }

        state.setIsDraggingWidget(false);
        state.setDraggedWidget(null);
    } else if (state.isResizing && state.resizingWidget) {
        state.resizingWidget.classList.remove('resizing');

        const index = parseInt(state.resizingWidget.dataset.widgetIndex);
        if (state.dashboardWidgets[index]) {
            state.dashboardWidgets[index].w = parseInt(state.resizingWidget.style.width) || 320;
            state.dashboardWidgets[index].h = parseInt(state.resizingWidget.style.height) || 400;
            saveDashboardWidgets();
        }

        state.setIsResizing(false);
        state.setResizingWidget(null);
    }
}

// Add dashboard widget
export function addDashboardWidget(type, id, x, y) {
    const exists = state.dashboardWidgets.some(w => w.type === type && w.id === id);
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

    state.dashboardWidgets.push(newWidget);
    saveDashboardWidgets();
    renderDashboard();
    updateCounts();
    showToast(`${type === 'folder' ? 'Folder' : 'Tag'} added to dashboard`, 'success');
}

// Remove dashboard widget
export function removeDashboardWidget(index) {
    state.dashboardWidgets.splice(index, 1);
    saveDashboardWidgets();
    renderDashboard();
    updateCounts();
    showToast('Widget removed', 'success');
}

// Show widget color picker
function showWidgetColorPicker(index, button) {
    const existingPicker = document.querySelector('.widget-color-picker');
    if (existingPicker) existingPicker.remove();

    const widget = state.dashboardWidgets[index];
    if (!widget) return;

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

    const rect = button.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = `${rect.bottom + 5}px`;
    picker.style.left = `${rect.left - 100}px`;

    document.body.appendChild(picker);

    picker.querySelectorAll('.color-picker-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = opt.dataset.color;
            updateWidgetColor(index, color);
            picker.remove();
        });
    });

    setTimeout(() => {
        document.addEventListener('click', function closePickerHandler(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closePickerHandler);
            }
        });
    }, 100);
}

// Update widget color
function updateWidgetColor(index, color) {
    if (state.dashboardWidgets[index]) {
        state.dashboardWidgets[index].color = color;
        saveDashboardWidgets();
        renderDashboard();
        showToast('Widget color updated', 'success');
    }
}

// Save dashboard widgets
function saveDashboardWidgets() {
    saveSettings({ dashboard_widgets: state.dashboardWidgets });
}

// Filter dashboard bookmarks
export function filterDashboardBookmarks(term) {
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

        widget.style.opacity = hasVisible || !term ? '1' : '0.5';
    });
}

// Make functions global for inline onclick handlers
window.saveCurrentView = saveCurrentView;
window.deleteView = deleteView;
window.restoreView = restoreView;

export default {
    renderDashboard,
    initDashboardDragDrop,
    addDashboardWidget,
    removeDashboardWidget,
    filterDashboardBookmarks
};
