/**
 * AnchorMarks - Tag Cloud Module
 * Renders an interactive, animated tag cloud visualization
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { logger } from "@utils/logger.ts";
import { escapeHtml } from "@utils/index.ts";
import { updateFilterButtonVisibility } from "@features/bookmarks/filters.ts";

// Color palette for tags (vibrant, modern colors)
const TAG_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#10b981", // emerald
];

// Get a consistent color for a tag name
function getTagColor(tagName: string, index: number): string {
  // Use tag metadata color if available
  if (state.tagMetadata[tagName]?.color) {
    return state.tagMetadata[tagName].color;
  }
  // Fall back to cycling through colors
  return TAG_COLORS[index % TAG_COLORS.length];
}

// Predefined font sizes like react-tagcloud approach
// These will scale proportionally based on container size
function getBaseFontSizes(containerHeight: number): number[] {
  // Scale font sizes based on available height
  const scale = Math.min(1, containerHeight / 600); // 600px is baseline
  const baseSizes = [14, 18, 24, 32, 40, 48, 56];

  return baseSizes.map((size) => Math.max(12, size * scale));
}

// Map tag count to font size index using linear scale
function getFontSizeForCount(
  count: number,
  minCount: number,
  maxCount: number,
  fontSizes: number[],
): number {
  if (maxCount === minCount) {
    return fontSizes[Math.floor(fontSizes.length / 2)];
  }

  // Linear scale from minCount to maxCount
  const range = maxCount - minCount;
  const normalized = (count - minCount) / range;

  // Map to font size index
  const index = Math.floor(normalized * (fontSizes.length - 1));
  return fontSizes[index];
}

// Calculate opacity based on count
function calculateOpacity(
  count: number,
  minCount: number,
  maxCount: number,
): number {
  const minOpacity = 0.6;
  const maxOpacity = 1;

  if (maxCount === minCount) {
    return (minOpacity + maxOpacity) / 2;
  }

  const scale = (count - minCount) / (maxCount - minCount);
  return minOpacity + scale * (maxOpacity - minOpacity);
}

// Build tag data from bookmarks
async function buildTagData(): Promise<{ name: string; count: number; color: string }[]> {
  const tagCounts: Record<string, number> = {};
  
  // Fetch ALL bookmarks from server for tag cloud (ignore current filters)
  let allBookmarks: any[] = [];
  try {
    allBookmarks = await api("/bookmarks?sort=recently_added");
  } catch (err) {
    logger.error("Failed to fetch all bookmarks for tag cloud", err);
    // Fallback to state.bookmarks if API call fails
    allBookmarks = state.bookmarks;
  }

  allBookmarks.forEach((b) => {
    if (b.tags) {
      b.tags.split(",").forEach((t) => {
        const tag = t.trim();
        if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });

  const tags = Object.keys(tagCounts)
    .map((name, index) => ({
      name,
      count: tagCounts[name],
      color: getTagColor(name, index),
    }))
    .sort((a, b) => b.count - a.count);

  return tags;
}

// Shuffle array (Fisher-Yates)
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Render the tag cloud
export async function renderTagCloud(): Promise<void> {
  updateFilterButtonVisibility();

  const container = document.getElementById("bookmarks-container");
  const emptyState = document.getElementById("empty-state");
  const bulkBar = document.getElementById("bulk-bar");

  if (!container) return;

  // Hide view toggle in tag cloud view
  document.querySelector(".view-toggle")?.classList.add("hidden");
  bulkBar?.classList.add("hidden");

  const tags = await buildTagData();

  if (tags.length === 0) {
    container.className = "tag-cloud-container";
    container.innerHTML = `
      <div class="tag-cloud-empty">
        <div class="tag-cloud-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        </div>
        <h3>No Tags Yet</h3>
        <p>Add tags to your bookmarks to see them visualized here</p>
      </div>
    `;
    if (emptyState) emptyState.classList.add("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  const minCount = Math.min(...tags.map((t) => t.count));
  const maxCount = Math.max(...tags.map((t) => t.count));

  // Shuffle tags for organic cloud appearance
  const shuffledTags = shuffleArray(tags);

  // Get container dimensions
  const canvasHeight = window.innerHeight - 300; // Account for header, legend, etc.

  // Get scaled font sizes based on container
  const fontSizes = getBaseFontSizes(canvasHeight);

  const tagCloudHtml = `
    <div class="tag-cloud-view">
      <div class="tag-cloud-header">
        <div class="tag-cloud-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <h2>Tag Cloud</h2>
          <span class="tag-cloud-count">${tags.length} tags</span>
        </div>
        <div class="tag-cloud-stats">
          <div class="tag-cloud-stat">
            <span class="stat-number">${tags.reduce((sum, t) => sum + t.count, 0)}</span>
            <span class="stat-label">total usages</span>
          </div>
          <div class="tag-cloud-stat">
            <span class="stat-number">${maxCount}</span>
            <span class="stat-label">most used</span>
          </div>
        </div>
      </div>
      
      <div class="tag-cloud-canvas" id="tag-cloud-canvas">
        ${shuffledTags
          .map((tag, index) => {
            const fontSize = getFontSizeForCount(
              tag.count,
              minCount,
              maxCount,
              fontSizes,
            );
            const opacity = calculateOpacity(tag.count, minCount, maxCount);
            const delay = (index * 0.03).toFixed(2);
            const rotation =
              Math.random() > 0.85
                ? Math.random() > 0.5
                  ? "rotate(-3deg)"
                  : "rotate(3deg)"
                : "rotate(0deg)";

            return `
              <button class="tag-cloud-tag" 
                      data-tag="${escapeHtml(tag.name)}"
                      data-count="${tag.count}"
                      style="
                        --tag-color: ${tag.color};
                        --tag-size: ${fontSize}px;
                        --tag-opacity: ${opacity};
                        --tag-delay: ${delay}s;
                        --tag-rotation: ${rotation};
                      "
                      title="${escapeHtml(tag.name)} (${tag.count} bookmark${tag.count !== 1 ? "s" : ""})">
                ${escapeHtml(tag.name)}
                <span class="tag-cloud-tag-count">${tag.count}</span>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="tag-cloud-legend">
        <div class="legend-item">
          <span class="legend-size legend-small">A</span>
          <span>Less used</span>
        </div>
        <div class="legend-gradient"></div>
        <div class="legend-item">
          <span class="legend-size legend-large">A</span>
          <span>Most used</span>
        </div>
      </div>
    </div>
  `;

  container.className = "tag-cloud-container";
  container.innerHTML = tagCloudHtml;

  // Attach click handlers
  container.querySelectorAll(".tag-cloud-tag").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const tagName = (btn as HTMLElement).dataset.tag;
      if (!tagName) return;

      // Navigate to bookmarks filtered by this tag
      state.setCurrentView("all");
      state.setCurrentFolder(null);
      state.filterConfig.tags = [tagName];

      const searchInput = document.getElementById(
        "search-input",
      ) as HTMLInputElement;
      if (searchInput) searchInput.value = "";

      const viewTitle = document.getElementById("view-title");
      if (viewTitle) viewTitle.textContent = `Tag: ${tagName}`;

      // Import and update UI
      const [{ renderActiveFilters, renderSidebarTags }, { loadBookmarks }] =
        await Promise.all([
          import("@features/bookmarks/search.ts"),
          import("@features/bookmarks/bookmarks.ts"),
        ]);

      const { updateActiveNav } = await import("@utils/ui-helpers.ts");
      updateActiveNav();
      renderActiveFilters();
      renderSidebarTags();
      loadBookmarks();
    });
  });

  // Add resize observer to redraw tag cloud on window resize
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  const handleResize = () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(async () => {
      // Only redraw if we're still in tag cloud view
      if (
        state.currentView === "tag-cloud" &&
        container.querySelector(".tag-cloud-view")
      ) {
        await renderTagCloud();
      }
    }, 300); // Debounce resize events
  };

  window.addEventListener("resize", handleResize);

  // Store cleanup function for when view changes
  (window as any).__tagCloudResizeCleanup = () => {
    window.removeEventListener("resize", handleResize);
    if (resizeTimeout) clearTimeout(resizeTimeout);
  };
}

export default {
  renderTagCloud,
};
