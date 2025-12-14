/**
 * AnchorMarks - Dashboard Module
 * Handles dashboard rendering and widget management
 */

import * as state from './state.js';
import { escapeHtml } from './utils.js';
import { showToast, dom, updateCounts } from './ui.js';
import { saveSettings } from './settings.js';

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
    container.innerHTML = '';
    if (emptyState) emptyState.classList.add('hidden');

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

        const folderBookmarks = state.bookmarks.filter(b => b.folder_id === folder.id);
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

        state.draggedWidget.style.left = `${state.widgetStartPos.x + deltaX}px`;
        state.draggedWidget.style.top = `${state.widgetStartPos.y + deltaY}px`;
    } else if (state.isResizing && state.resizingWidget) {
        const deltaX = e.clientX - state.dragStartPos.x;
        const deltaY = e.clientY - state.dragStartPos.y;

        const newWidth = Math.max(250, state.resizeStartSize.w + deltaX);
        const newHeight = Math.max(200, state.resizeStartSize.h + deltaY);

        state.resizingWidget.style.width = `${newWidth}px`;
        state.resizingWidget.style.height = `${newHeight}px`;
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

export default {
    renderDashboard,
    initDashboardDragDrop,
    addDashboardWidget,
    removeDashboardWidget,
    filterDashboardBookmarks
};
