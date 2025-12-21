/**
 * AnchorMarks - Omnibar Module
 * Interactive command palette that merges search and quick actions
 */

import * as state from "@features/state.ts";
import { getCommandPaletteCommands } from "@features/bookmarks/commands.ts";
import { escapeHtml } from "@utils/index.ts";
import { Icon } from "@components/index.ts";

const RECENT_SEARCHES_KEY = "anchormarks_recent_searches";
const MAX_RECENT_SEARCHES = 10;

interface OmnibarState {
    isOpen: boolean;
    activeIndex: number;
    currentItems: OmnibarItem[];
}

interface OmnibarItem {
    type: "recent" | "tag" | "action" | "result";
    label: string;
    description?: string;
    icon?: string;
    favicon?: string;
    action: () => void;
}

let omnibarState: OmnibarState = {
    isOpen: false,
    activeIndex: 0,
    currentItems: [],
};

// Get recent searches from localStorage
export function getRecentSearches(): string[] {
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Add a search to recent history
export function addRecentSearch(query: string): void {
    if (!query || query.trim().length === 0) return;

    const trimmed = query.trim();
    const recent = getRecentSearches();

    // Remove if already exists
    const filtered = recent.filter((s) => s !== trimmed);

    // Add to front
    filtered.unshift(trimmed);

    // Keep only MAX_RECENT_SEARCHES
    const limited = filtered.slice(0, MAX_RECENT_SEARCHES);

    try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limited));
    } catch {
        // Ignore localStorage errors
    }
}

// Clear recent searches
export function clearRecentSearches(): void {
    try {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
        // Ignore localStorage errors
    }
    renderOmnibarPanel("");
}

// Remove a single recent search
export function removeRecentSearch(query: string): void {
    const recent = getRecentSearches();
    const filtered = recent.filter((s) => s !== query);

    try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(filtered));
    } catch {
        // Ignore localStorage errors
    }
    renderOmnibarPanel("");
}

// Get suggested tags (top 8 most used)
export function getSuggestedTags(): Array<{ name: string; count: number }> {
    const tagCounts: Record<string, number> = {};

    state.bookmarks.forEach((b) => {
        if (b.tags) {
            b.tags.split(",").forEach((t) => {
                const tag = t.trim();
                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });

    const tags = Object.keys(tagCounts).map((name) => ({
        name,
        count: tagCounts[name],
    }));

    // Sort by count descending
    tags.sort((a, b) => b.count - a.count);

    return tags.slice(0, 8);
}

// Get quick actions (most common commands)
export function getQuickActions(): OmnibarItem[] {
    return [
        {
            type: "action",
            label: "Add bookmark",
            icon: "plus",
            action: () => {
                import("@utils/ui-helpers.ts").then(({ openModal }) =>
                    openModal("bookmark-modal")
                );
            },
        },
        {
            type: "action",
            label: "View favorites",
            icon: "star",
            action: () => {
                state.setCurrentView("favorites");
                state.setCurrentFolder(null);
                import("@utils/ui-helpers.ts").then(({ updateActiveNav }) =>
                    updateActiveNav()
                );
                const viewTitle = document.getElementById("view-title");
                if (viewTitle) viewTitle.textContent = "Favorites";
                import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
                    loadBookmarks()
                );
            },
        },
        {
            type: "action",
            label: "View dashboard",
            icon: "grid",
            action: () => {
                state.setCurrentView("dashboard");
                state.setCurrentFolder(null);
                import("@utils/ui-helpers.ts").then(({ updateActiveNav }) =>
                    updateActiveNav()
                );
                const viewTitle = document.getElementById("view-title");
                if (viewTitle) viewTitle.textContent = "Dashboard";
                import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
                    loadBookmarks()
                );
            },
        },
        {
            type: "action",
            label: "Open settings",
            icon: "settings",
            action: () => {
                import("@utils/ui-helpers.ts").then(({ openModal }) =>
                    openModal("settings-modal")
                );
            },
        },
    ];
}

// Open omnibar panel
export function openOmnibar(): void {
    const panel = document.getElementById("omnibar-panel");
    const input = document.getElementById("search-input") as HTMLInputElement;

    if (!panel) return;

    omnibarState.isOpen = true;
    panel.classList.remove("hidden");

    // Render initial content
    renderOmnibarPanel(input?.value || "");
}

// Close omnibar panel
export function closeOmnibar(): void {
    const panel = document.getElementById("omnibar-panel");

    if (!panel) return;

    omnibarState.isOpen = false;
    panel.classList.add("hidden");
    omnibarState.activeIndex = 0;
    omnibarState.currentItems = [];
}

// Toggle omnibar
export function toggleOmnibar(): void {
    if (omnibarState.isOpen) {
        closeOmnibar();
    } else {
        openOmnibar();
    }
}

// Render omnibar panel content
export function renderOmnibarPanel(query: string): void {
    const panel = document.getElementById("omnibar-panel");
    if (!panel) return;

    const recentSection = document.getElementById("omnibar-recent");
    const tagsSection = document.getElementById("omnibar-tags");
    const actionsSection = document.getElementById("omnibar-actions");
    const resultsSection = document.getElementById("omnibar-results");

    if (!recentSection || !tagsSection || !actionsSection || !resultsSection) return;

    const trimmedQuery = query.trim();

    // If there's a query, show search results
    if (trimmedQuery.length > 0) {
        // Hide default sections
        recentSection.classList.add("hidden");
        tagsSection.classList.add("hidden");
        actionsSection.classList.add("hidden");
        resultsSection.classList.remove("hidden");

        // Get results from command palette system
        const commands = getCommandPaletteCommands(trimmedQuery);
        omnibarState.currentItems = commands.map((cmd) => ({
            type: "result",
            label: cmd.label,
            description: cmd.description,
            icon: cmd.icon,
            favicon: cmd.favicon,
            action: cmd.action,
        }));

        renderResultsList(commands);
    } else {
        // Show default sections
        resultsSection.classList.add("hidden");

        // Recent searches
        const recentSearches = getRecentSearches();
        if (recentSearches.length > 0) {
            recentSection.classList.remove("hidden");
            renderRecentSearches(recentSearches);
        } else {
            recentSection.classList.add("hidden");
        }

        // Suggested tags
        const suggestedTags = getSuggestedTags();
        if (suggestedTags.length > 0) {
            tagsSection.classList.remove("hidden");
            renderSuggestedTags(suggestedTags);
        } else {
            tagsSection.classList.add("hidden");
        }

        // Quick actions
        actionsSection.classList.remove("hidden");
        renderQuickActions();
    }
}

// Render recent searches
function renderRecentSearches(searches: string[]): void {
    const list = document.getElementById("omnibar-recent-list");
    if (!list) return;

    list.innerHTML = searches
        .map(
            (search) => `
    <div class="omnibar-recent-item" data-search="${escapeHtml(search)}">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        ${Icon("clock", { size: 16 })}
        <span>${escapeHtml(search)}</span>
      </div>
      <button class="omnibar-recent-remove btn-icon" data-search="${escapeHtml(search)}" title="Remove">
        ${Icon("close", { size: 14 })}
      </button>
    </div>
  `
        )
        .join("");

    // Add click handlers
    list.querySelectorAll(".omnibar-recent-item").forEach((item) => {
        const searchQuery = (item as HTMLElement).dataset.search;
        if (!searchQuery) return;

        item.addEventListener("click", (e) => {
            // Don't trigger if clicking the remove button
            if ((e.target as HTMLElement).closest(".omnibar-recent-remove")) return;

            const input = document.getElementById("search-input") as HTMLInputElement;
            if (input) {
                input.value = searchQuery;
                input.dispatchEvent(new Event("input", { bubbles: true }));
            }
            closeOmnibar();
        });
    });

    // Add remove handlers
    list.querySelectorAll(".omnibar-recent-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const searchQuery = (btn as HTMLElement).dataset.search;
            if (searchQuery) {
                removeRecentSearch(searchQuery);
            }
        });
    });
}

// Render suggested tags
function renderSuggestedTags(tags: Array<{ name: string; count: number }>): void {
    const list = document.getElementById("omnibar-tags-list");
    if (!list) return;

    list.innerHTML = `
    <div class="omnibar-tags-grid">
      ${tags
            .map(
                (tag) => `
        <div class="omnibar-tag-pill" data-tag="${escapeHtml(tag.name)}">
          <span>${escapeHtml(tag.name)}</span>
          <span style="opacity: 0.6; font-size: 0.75rem;">${tag.count}</span>
        </div>
      `
            )
            .join("")}
    </div>
  `;

    // Add click handlers
    list.querySelectorAll(".omnibar-tag-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            const tagName = (pill as HTMLElement).dataset.tag;
            if (!tagName) return;

            // Filter by tag
            import("@features/bookmarks/search.ts").then(({ sidebarFilterTag }) => {
                sidebarFilterTag(tagName);
            });
            closeOmnibar();
        });
    });
}

// Render quick actions
function renderQuickActions(): void {
    const list = document.getElementById("omnibar-actions-list");
    if (!list) return;

    const actions = getQuickActions();

    list.innerHTML = actions
        .map(
            (action) => `
    <div class="omnibar-item" data-action="${escapeHtml(action.label)}">
      <div class="omnibar-item-icon">
        ${action.icon ? Icon(action.icon, { size: 18 }) : ""}
      </div>
      <div class="omnibar-item-content">
        <div class="omnibar-item-label">${escapeHtml(action.label)}</div>
      </div>
    </div>
  `
        )
        .join("");

    // Add click handlers
    list.querySelectorAll(".omnibar-item").forEach((item, index) => {
        item.addEventListener("click", () => {
            actions[index].action();
            closeOmnibar();
        });
    });
}

// Render search results
function renderResultsList(commands: any[]): void {
    const list = document.getElementById("omnibar-results-list");
    if (!list) return;

    if (commands.length === 0) {
        list.innerHTML = `
      <div class="omnibar-item empty" style="justify-content: center; color: var(--text-tertiary); font-style: italic;">
        No results found
      </div>
    `;
        return;
    }

    list.innerHTML = commands
        .map((cmd, idx) => {
            let iconHtml = "";
            if (cmd.category === "bookmark" && cmd.favicon) {
                iconHtml = `<img class="command-favicon" src="${escapeHtml(cmd.favicon)}" alt="" onerror="this.style.display='none'" style="width: 16px; height: 16px; border-radius: 2px;" />`;
            } else if (cmd.icon) {
                iconHtml = `<span class="command-icon">${cmd.icon}</span>`;
            }

            const categoryBadge =
                cmd.category && cmd.category !== "command"
                    ? `<span class="command-category ${cmd.category}">${cmd.category}</span>`
                    : "";

            return `
        <div class="omnibar-item ${cmd.category || ""} ${idx === omnibarState.activeIndex ? "active" : ""}" data-index="${idx}">
          <div class="omnibar-item-icon">
            ${iconHtml}
          </div>
          <div class="omnibar-item-content">
            <div class="omnibar-item-label">${escapeHtml(cmd.label)}</div>
            ${cmd.description && cmd.category !== "bookmark" ? `<div class="omnibar-item-description">${escapeHtml(cmd.description)}</div>` : ""}
          </div>
          ${categoryBadge}
        </div>
      `;
        })
        .join("");

    // Add click handlers
    list.querySelectorAll(".omnibar-item").forEach((item, index) => {
        item.addEventListener("click", () => {
            commands[index].action();
            closeOmnibar();

            // Add to recent searches if it's a search query
            const input = document.getElementById("search-input") as HTMLInputElement;
            if (input && input.value.trim() && !input.value.startsWith(">") && !input.value.startsWith("@") && !input.value.startsWith("#")) {
                addRecentSearch(input.value.trim());
            }
        });

        // Hover to activate
        item.addEventListener("mouseenter", () => {
            omnibarState.activeIndex = index;
            updateActiveItem();
        });
    });
}

// Update active item styling
function updateActiveItem(): void {
    const list = document.getElementById("omnibar-results-list");
    if (!list) return;

    list.querySelectorAll(".omnibar-item").forEach((item, idx) => {
        item.classList.toggle("active", idx === omnibarState.activeIndex);
    });

    const active = list.querySelector(".omnibar-item.active");
    if (active) active.scrollIntoView({ block: "nearest" });
}

// Navigate with keyboard
export function navigateOmnibar(direction: "up" | "down"): void {
    if (!omnibarState.isOpen) return;

    const list = document.getElementById("omnibar-results-list");
    if (!list) return;

    const items = list.querySelectorAll(".omnibar-item:not(.empty)");
    if (items.length === 0) return;

    if (direction === "down") {
        omnibarState.activeIndex = Math.min(
            items.length - 1,
            omnibarState.activeIndex + 1
        );
    } else {
        omnibarState.activeIndex = Math.max(0, omnibarState.activeIndex - 1);
    }

    updateActiveItem();
}

// Execute active item
export function executeActiveItem(): void {
    if (!omnibarState.isOpen) return;

    const list = document.getElementById("omnibar-results-list");
    if (!list) return;

    const items = list.querySelectorAll(".omnibar-item:not(.empty)");
    const activeItem = items[omnibarState.activeIndex];

    if (activeItem) {
        (activeItem as HTMLElement).click();
    }
}

export default {
    openOmnibar,
    closeOmnibar,
    toggleOmnibar,
    renderOmnibarPanel,
    getRecentSearches,
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
    getSuggestedTags,
    getQuickActions,
    navigateOmnibar,
    executeActiveItem,
};
