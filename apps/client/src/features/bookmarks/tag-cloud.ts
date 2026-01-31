/**
 * AnchorMarks - Tag Cloud Module
 * Renders an interactive, animated tag cloud visualization
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { logger } from "@utils/logger.ts";
import { escapeHtml, safeLocalStorage } from "@utils/index.ts";
import { updateFilterButtonVisibility } from "@features/bookmarks/filters.ts";
import { dom, showToast } from "@utils/ui-helpers.ts";

// Gradient stops used for count → color mapping (low → high)
// Designed to resemble the rainbow look in the mock
const COUNT_GRADIENT_STOPS = [
  "#6366f1", // indigo (least)
  "#06b6d4", // cyan
  "#22c55e", // green
  "#eab308", // yellow
  "#f97316", // orange
  "#ec4899", // pink (most)
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolate(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

// Linear interpolation between multiple color stops
function interpolateGradient(stops: string[], t: number): string {
  if (t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  const segment = 1 / (stops.length - 1);
  const i = Math.floor(t / segment);
  const localT = (t - i * segment) / segment;

  const c1 = hexToRgb(stops[i]);
  const c2 = hexToRgb(stops[i + 1]);
  const r = interpolate(c1.r, c2.r, localT);
  const g = interpolate(c1.g, c2.g, localT);
  const b = interpolate(c1.b, c2.b, localT);
  return rgbToHex(r, g, b);
}

// Map count in [min,max] to a hex color from gradient
function getColorForCount(
  count: number,
  minCount: number,
  maxCount: number,
): string {
  if (maxCount === minCount)
    return COUNT_GRADIENT_STOPS[Math.floor(COUNT_GRADIENT_STOPS.length / 2)];
  const t = (count - minCount) / (maxCount - minCount);
  return interpolateGradient(COUNT_GRADIENT_STOPS, t);
}

// Choose black/white text for contrast vs background color
function getContrastText(bgHex: string): string {
  const { r, g, b } = hexToRgb(bgHex);
  // Relative luminance (WCAG)
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.6 ? "#0f172a" /* slate-900 for light colors */ : "#ffffff";
}

// Predefined font sizes like react-tagcloud approach
// These will scale proportionally based on container size
function getBaseFontSizes(containerHeight: number): number[] {
  // Scale font sizes based on available height
  const scale = Math.min(1, containerHeight / 600); // 600px is baseline
  // Reduced base sizes to fit more tags
  const baseSizes = [12, 16, 20, 26, 32, 36, 44];

  return baseSizes.map((size) => Math.max(11, size * scale));
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
async function buildTagData(): Promise<{ name: string; count: number }[]> {
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

  // Helper to extract normalized tags from bookmark (handles string or array)
  const extractTags = (bookmark: any): string[] => {
    if (!bookmark.tags) return [];
    if (Array.isArray(bookmark.tags))
      return bookmark.tags.map((t: any) => String(t).trim()).filter(Boolean);
    if (typeof bookmark.tags === "object") {
      try {
        return Object.values(bookmark.tags)
          .map((v: any) => String(v).trim())
          .filter(Boolean);
      } catch (e) {
        return [];
      }
    }
    return String(bookmark.tags)
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
  };

  allBookmarks.forEach((b) => {
    const tags = extractTags(b);
    tags.forEach((t: string) => {
      const tag = t;
      if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const tags = Object.keys(tagCounts)
    .map((name) => ({
      name,
      count: tagCounts[name],
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
  if (state.currentView !== "tag-cloud") return;
  updateFilterButtonVisibility();

  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
  const emptyState = document.getElementById("empty-state");
  const bulkBar = document.getElementById("bulk-bar");

  if (!container) return;

  // Hide view toggle in tag cloud view
  document.querySelector(".view-toggle")?.classList.add("hidden");
  bulkBar?.classList.add("hidden");

  const tags = await buildTagData();
  const storedPref = safeLocalStorage.getItem("anchormarks_tag_cloud_show_all");
  const showAllPref =
    storedPref !== null
      ? storedPref === "true"
      : !!state.tagCloudDefaultShowAll;

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

  // Determine how many tags we can reasonably show; drop low-count tags
  const vw = window.innerWidth;
  let MAX_TAGS = state.tagCloudMaxTags || 120;
  if (vw < 480) MAX_TAGS = 40;
  else if (vw < 768) MAX_TAGS = Math.max(30, Math.round(MAX_TAGS * 0.5));
  else if (vw < 1280) MAX_TAGS = Math.max(60, Math.round(MAX_TAGS * 0.75));
  else MAX_TAGS = Math.max(40, Math.round(MAX_TAGS));
  const topTags = showAllPref
    ? tags
    : tags.slice(0, Math.min(tags.length, MAX_TAGS));
  const minCount = Math.min(...topTags.map((t) => t.count));
  const maxCount = Math.max(...topTags.map((t) => t.count));

  // Shuffle top tags for organic cloud appearance
  const shuffledTags = shuffleArray(topTags);

  // Get container dimensions - compute available height using the sticky header
  const headerEl = document.querySelector(".content-header") as HTMLElement;
  const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 64;

  // Temporarily render to measure legend height dynamically
  const tempContainerId = `__temp-tag-cloud-${Date.now()}`;
  const tempDiv = document.createElement("div");
  tempDiv.id = tempContainerId;
  tempDiv.style.visibility = "hidden";
  tempDiv.style.position = "absolute";
  tempDiv.style.top = "0";
  tempDiv.style.width = "100%";
  document.body.appendChild(tempDiv);

  // Render legend in temp container to measure its height
  tempDiv.innerHTML = `
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
  `;

  const legendEl = tempDiv.querySelector(".tag-cloud-legend") as HTMLElement;
  const legendHeight = legendEl ? legendEl.getBoundingClientRect().height : 50;
  document.body.removeChild(tempDiv);

  // Reserve space for header reserve (tag-cloud-header, padding, etc.) + measured legend
  const headerReserve = 100; // px for tag-cloud-header + padding
  const legendReserve = legendHeight + headerReserve;
  const canvasHeight = Math.max(
    300,
    window.innerHeight - headerHeight - legendReserve,
  );

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
          <span class="tag-cloud-count">${showAllPref ? `${topTags.length}` : `${topTags.length} of ${tags.length}`} tags</span>
        </div>
        <div class="tag-cloud-stats">
          <div class="tag-cloud-stat">
            <span class="stat-number">${topTags.reduce((sum, t) => sum + t.count, 0)}</span>
            <span class="stat-label">total usages</span>
          </div>
          <div class="tag-cloud-stat">
            <span class="stat-number">${maxCount}</span>
            <span class="stat-label">most used</span>
          </div>
          <div class="tag-cloud-stat">
            <button id="tag-cloud-toggle" class="tag-cloud-toggle" aria-pressed="${showAllPref}">
              ${showAllPref ? "Show Top" : "Show All"}
            </button>
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
            const bgColor = getColorForCount(tag.count, minCount, maxCount);
            const textColor = getContrastText(bgColor);

            return `
              <button class="tag-cloud-tag" 
                      data-tag="${JSON.stringify(tag.name).slice(1, -1)}"
                      data-count="${tag.count}"
                      style="
                        --tag-color: ${bgColor};
                        --tag-text: ${textColor};
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

  // Ensure the canvas has a min-height based on the computed canvasHeight
  const canvasEl = container.querySelector(
    ".tag-cloud-canvas",
  ) as HTMLElement | null;
  if (canvasEl) {
    canvasEl.style.minHeight = `${canvasHeight}px`;
    canvasEl.style.setProperty(
      "--tag-cloud-canvas-height",
      `${canvasHeight}px`,
    );
  }

  // Toggle button handler
  const toggleBtn = document.getElementById("tag-cloud-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      const next = !showAllPref;
      safeLocalStorage.setItem("anchormarks_tag_cloud_show_all", String(next));
      await renderTagCloud();
    });
  }

  // Attach click handlers
  container.querySelectorAll(".tag-cloud-tag").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const rawTagName = (btn as HTMLElement).dataset.tag;
      if (!rawTagName) return;
      // Defensive decode of HTML entities (dataset may already be decoded in most browsers)
      let tagName = rawTagName;
      try {
        const tmp = document.createElement("textarea");
        tmp.innerHTML = tagName;
        tagName = tmp.value;
      } catch (e) {
        // ignore and use raw value
      }

      // Navigate to bookmarks filtered by this tag
      state.setCurrentView("all");
      state.setCurrentFolder(null);
      // Use setter to replace filter config (avoids mutation edge cases)
      state.setFilterConfig({ ...state.filterConfig, tags: [tagName] });

      const searchInput = document.getElementById(
        "search-input",
      ) as HTMLInputElement;
      if (searchInput) searchInput.value = "";

      // Refresh header to match the Bookmarks view
      const { updateHeaderContent } = await import("@/App.ts");
      await updateHeaderContent();

      const viewTitle = document.getElementById("view-title");
      if (viewTitle) viewTitle.textContent = `Tag: ${tagName}`;

      // Import and update UI (robust: handle import failures with graceful fallback)
      let renderActiveFilters: any = null;
      let renderSidebarTags: any = null;
      let loadBookmarks: any = null;

      try {
        const [searchMod, bookmarksMod] = await Promise.all([
          import("@features/bookmarks/search.ts"),
          import("@features/bookmarks/bookmarks.ts"),
        ]);
        renderActiveFilters = searchMod.renderActiveFilters;
        renderSidebarTags = searchMod.renderSidebarTags;
        loadBookmarks = bookmarksMod.loadBookmarks;
      } catch (err) {
        logger.error(
          "Failed to dynamically import bookmark modules from Tag Cloud click handler",
          err,
        );
        // Fallback: try to at least import bookmarks module so we can call loadBookmarks
        try {
          const bookmarksMod = await import("@features/bookmarks/bookmarks.ts");
          loadBookmarks = bookmarksMod.loadBookmarks;
        } catch (err2) {
          logger.error("Fallback import for bookmarks failed", err2);
        }
      }

      const { updateActiveNav } = await import("@utils/ui-helpers.ts");
      updateActiveNav();

      if (renderActiveFilters) renderActiveFilters();
      if (renderSidebarTags) renderSidebarTags();

      if (typeof loadBookmarks === "function") {
        logger.info(`Tag Cloud: invoking loadBookmarks for tag "${tagName}"`);
        try {
          await loadBookmarks();
        } catch (err) {
          logger.error("loadBookmarks failed after Tag Cloud click", err);
          try {
            showToast("Failed to load bookmarks", "error");
          } catch (_) {
            // ignore toast errors in environments where UI isn't attached
          }
        }
      } else {
        logger.error(
          "loadBookmarks not available after Tag Cloud click imports",
        );
        try {
          showToast("Could not load bookmarks", "error");
        } catch (_) {
          // ignore
        }
      }
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
