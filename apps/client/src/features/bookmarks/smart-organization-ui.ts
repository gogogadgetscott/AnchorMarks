/**
 * Smart Organization Frontend Components
 *
 * This module provides smart tag suggestions, collection recommendations,
 * and bookmark insights using the AnchorMarks API.
 * 
 * @deprecated This entire module uses legacy DOM manipulation patterns.
 * MIGRATION PLAN:
 * 1. Create React components: SmartTagSuggestions.tsx, SmartCollections.tsx, SmartInsights.tsx
 * 2. Move API calls to custom hooks (useSmartTags, useSmartCollections, useSmartInsights)
 * 3. Replace direct DOM manipulation with React state and Context
 * 4. Update BookmarkModal.tsx to use the new SmartTagSuggestions component
 * 5. Remove window API access pattern - use React Context directly
 * 
 * For now, these functions remain functional but should not be used in new code.
 */

import type {
  SmartTagSuggestion,
  SmartInsights,
  DomainStats,
} from "../../types/index";

/** Shape of the global AnchorMarks API exposed on `window` */
interface AnchorMarksAPI {
  api?: (endpoint: string, options?: RequestInit) => Promise<unknown>;
  isAuthenticated?: () => boolean;
  escapeHtml?: (text: string) => string;
  showToast?: (message: string, type?: string) => void;
  addTagToInput?: (tag: string) => void;
  loadFolders?: () => void;
  aiSuggestionsEnabled?: boolean;
}

// Get reference to main app API
function getAPI(): AnchorMarksAPI {
  return ((window as unknown as { AnchorMarks?: AnchorMarksAPI }).AnchorMarks ||
    window) as AnchorMarksAPI;
}

// Helper to safely call API
async function api(endpoint: string, options?: RequestInit): Promise<any> {
  const AM = getAPI();
  if (AM.api) {
    return AM.api(endpoint, options);
  }
  // Fallback to fetch
  const response = await fetch("/api" + endpoint, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  return response.json();
}

// Helper functions
function escapeHtml(text: string): string {
  const AM = getAPI();
  if (AM.escapeHtml) return AM.escapeHtml(text);
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message: string, type?: string): void {
  const AM = getAPI();
  if (AM.showToast) AM.showToast(message, type);
}

function addTagToInput(tag: string): void {
  import("@features/bookmarks/tag-input.ts").then(({ addTag }) => addTag(tag));
}

function loadFolders(): void {
  const AM = getAPI();
  if (AM.loadFolders) AM.loadFolders();
}

// ============== SMART TAG SUGGESTIONS ==============

let smartTagSuggestTimeout: ReturnType<typeof setTimeout> | undefined;
let smartTagSuggestSeq = 0;

/**
 * @deprecated This function performs direct DOM manipulation.
 * Should be converted to a React component (SmartTagSuggestions)
 * that uses state and context instead of document.getElementById.
 * Currently used by BookmarkModal.tsx - needs to be migrated together.
 */
async function showSmartTagSuggestions(url: string): Promise<void> {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions || !url) {
    renderTagSuggestions([]);
    return;
  }

  clearTimeout(smartTagSuggestTimeout);
  const seq = ++smartTagSuggestSeq;

  smartTagSuggestTimeout = setTimeout(async () => {
    if (seq !== smartTagSuggestSeq) return;
    renderSuggestionsLoading();

    try {
      const response = await api(
        `/tags/suggest-smart?url=${encodeURIComponent(url)}&limit=8`,
      );

      if (seq !== smartTagSuggestSeq) return;

      if (response.suggestions && response.suggestions.length > 0) {
        renderSmartTagSuggestions(response.suggestions, response.domain_info);
      } else {
        renderTagSuggestions([]);
      }

      // Try AI suggestions (optional)
      const AM = getAPI();
      const aiAllowed = AM.aiSuggestionsEnabled !== false;
      if (aiAllowed) {
        appendAILoadingIndicator();
        try {
          const ai = await api(
            `/tags/suggest-ai?url=${encodeURIComponent(url)}&limit=6`,
          );
          if (seq !== smartTagSuggestSeq) return;
          removeAILoadingIndicator();
          if (ai && ai.suggestions && ai.suggestions.length) {
            appendAISuggestions(ai.suggestions);
          }
        } catch (aiErr) {
          removeAILoadingIndicator();
          // Ignore if not configured or failed
        }
      }
    } catch (err) {
      console.error("Smart tag suggestions failed:", err);
      if (seq === smartTagSuggestSeq) renderTagSuggestions([]);
    }
  }, 400);
}

/**
 * @deprecated Direct DOM manipulation - convert to React loading state
 */
function renderSuggestionsLoading(): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions) return;
  tagSuggestions.innerHTML = `
    <span class="tag-suggestions-loading text-tertiary">
      <span class="loading-dots">Fetching suggestions<span>.</span><span>.</span><span>.</span></span>
    </span>
  `;
}

function appendAILoadingIndicator(): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions) return;
  const el = document.createElement("div");
  el.id = "ai-suggestions-loading";
  el.className = "ai-suggestions-header text-tertiary";
  el.innerHTML = `<span>🤖 AI thinking<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></span>`;
  tagSuggestions.appendChild(el);
}

function removeAILoadingIndicator(): void {
  document.getElementById("ai-suggestions-loading")?.remove();
}

/**
 * @deprecated Direct DOM manipulation - convert to React component with state.
 * Should be part of a SmartTagSuggestions React component.
 */
function renderTagSuggestions(list: string[]): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions) return;

  if (!list || list.length === 0) {
    tagSuggestions.innerHTML =
      '<span class="text-tertiary" style="font-size:0.85rem;">No suggestions</span>';
    return;
  }

  tagSuggestions.innerHTML = list
    .map(
      (tag: string) => `
    <button type="button" class="tag-suggestion" data-tag="${escapeHtml(tag)}">
      ${escapeHtml(tag)}
    </button>
  `,
    )
    .join("");

  // Add click handlers
  tagSuggestions.querySelectorAll(".tag-suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      addTagToInput((btn as HTMLElement).dataset.tag || "");
    });
  });
}

/**
 * @deprecated Direct DOM manipulation - convert to React component.
 * Should be part of a SmartTagSuggestions React component with proper state management.
 */
function renderSmartTagSuggestions(
  suggestions: SmartTagSuggestion[],
  domainInfo: {
    domain: string;
    bookmarkCount?: number;
    bookmark_count?: number;
    category?: string;
  },
): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions) return;

  if (!suggestions || suggestions.length === 0) {
    tagSuggestions.innerHTML =
      '<span class="text-tertiary" style="font-size:0.85rem;">No suggestions</span>';
    return;
  }

  const html = suggestions
    .map((sugg: SmartTagSuggestion) => {
      const sourceIcon =
        (
          {
            domain: "🌐",
            activity: "📊",
            similar: "🔗",
          } as Record<string, string>
        )[sugg.source] || "✨";

      return `
      <div class="smart-tag-suggestion" data-tag="${escapeHtml(sugg.tag)}" title="${escapeHtml(sugg.reason)}">
        <button type="button" class="tag-suggestion-btn">
          <span class="source-icon">${sourceIcon}</span>
          <span class="tag-name">${escapeHtml(sugg.tag)}</span>
          <span class="tag-score">${Math.round(sugg.score * 100)}%</span>
        </button>
      </div>
    `;
    })
    .join("");

  tagSuggestions.innerHTML = html;

  // Add click handlers
  tagSuggestions.querySelectorAll(".tag-suggestion-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = btn.closest(".smart-tag-suggestion") as HTMLElement;
      if (container) {
        addTagToInput(container.dataset.tag || "");
      }
    });
  });

  // Add domain info
  if (domainInfo && domainInfo.domain) {
    const infoEl = document.createElement("div");
    infoEl.className = "domain-info-mini text-tertiary";
    infoEl.style.cssText =
      "font-size:0.75rem; margin-top:8px; padding-top:8px; border-top:1px solid var(--border-color);";
    const count = domainInfo.bookmarkCount ?? domainInfo.bookmark_count ?? 0;
    infoEl.innerHTML = `
      📌 ${count} bookmarks from ${escapeHtml(domainInfo.domain)}
      ${domainInfo.category ? ` • ${escapeHtml(domainInfo.category)}` : ""}
    `;
    tagSuggestions.appendChild(infoEl);
  }
}

/**
 * @deprecated Direct DOM manipulation - convert to React component.
 * Should append to SmartTagSuggestions React component state instead of DOM.
 */
function appendAISuggestions(
  suggestions: Array<string | { tag: string }>,
): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions || !suggestions || !suggestions.length) return;

  const tagNames = suggestions.map((sugg: string | { tag: string }) =>
    typeof sugg === "string" ? sugg : sugg.tag,
  );

  const header = document.createElement("div");
  header.className = "ai-suggestions-header text-tertiary";
  header.innerHTML = `
    <span>🤖 AI Suggestions</span>
    <button type="button" class="btn btn-secondary" style="font-size:0.75rem; padding:2px 8px; height:auto;">Add All</button>
  `;
  header.querySelector("button")?.addEventListener("click", () => {
    tagNames.forEach((name) => addTagToInput(name));
  });
  tagSuggestions.appendChild(header);

  const row = document.createElement("div");
  row.className = "ai-suggestions-row";
  tagNames.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = "smart-tag-suggestion";
    pill.dataset.tag = name;
    pill.title = "AI-generated";
    pill.innerHTML = `<button type="button" class="tag-suggestion-btn"><span class="source-icon">🤖</span><span class="tag-name">${escapeHtml(name)}</span></button>`;
    pill
      .querySelector("button")
      ?.addEventListener("click", () => addTagToInput(name));
    row.appendChild(pill);
  });
  tagSuggestions.appendChild(row);
}

// ============== SMART COLLECTIONS ==============

async function loadSmartCollections() {
  // Don't load if not authenticated
  const AM = getAPI();
  if (!AM.isAuthenticated || !AM.isAuthenticated()) return;

  try {
    const response = await api("/smart-collections/suggest?limit=5");

    if (response.collections && response.collections.length > 0) {
      renderSmartCollectionSuggestions(response.collections);
    }
  } catch (err) {
    console.error("Failed to load smart collections:", err);
  }
}

/**
 * @deprecated Direct DOM manipulation - convert to SmartCollections React component.
 * This entire smart collections UI should be a proper React component with Context.
 */
function renderSmartCollectionSuggestions(
  collections: Array<{
    name: string;
    icon: string;
    reason: string;
    bookmark_count: number;
    type: string;
    tags?: string[];
  }>,
): void {
  const container = document.getElementById("smart-collections-suggestions");
  if (!container) return;

  if (!collections || collections.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  container.innerHTML = `
    <div class="smart-collections-header">
      <h3>✨ Smart Collections</h3>
      <button class="close-smart-collections btn-icon" aria-label="Close">✕</button>
    </div>
    <div class="smart-collections-list">
      ${collections
        .map(
          (coll) => `
        <div class="smart-collection-card">
          <div class="collection-header">
            <span class="collection-icon" style="font-size:1.5rem;">${getCollectionIcon(coll.icon)}</span>
            <div class="collection-info">
              <h4 class="collection-name">${escapeHtml(coll.name)}</h4>
              <p class="collection-reason text-tertiary">${escapeHtml(coll.reason)}</p>
            </div>
          </div>
          <div class="collection-meta">
            <span class="collection-count">📚 ${coll.bookmark_count}</span>
            <span class="collection-type">${escapeHtml(coll.type)}</span>
          </div>
          ${
            coll.tags
              ? `
              <div class="collection-tags">
                ${coll.tags
                  .slice(0, 3)
                  .map(
                    (t: string) =>
                      `<span class="tag-badge">${escapeHtml(t)}</span>`,
                  )
                  .join("")}
                ${coll.tags.length > 3 ? `<span class="tag-badge more">+${coll.tags.length - 3}</span>` : ""}
              </div>
            `
              : ""
          }
          <button class="btn btn-secondary create-collection-btn" data-collection='${escapeHtml(JSON.stringify(coll))}'>
            Create Collection
          </button>
        </div>
      `,
        )
        .join("")}
    </div>
  `;

  // Add event listeners
  container
    .querySelector(".close-smart-collections")
    ?.addEventListener("click", () => {
      container.style.display = "none";
    });

  container.querySelectorAll(".create-collection-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      createSmartCollectionFromSuggestion(
        (btn as HTMLElement).dataset.collection || "",
      );
    });
  });
}

function getCollectionIcon(icon: string): string {
  const iconMap: Record<string, string> = {
    clock: "🕐",
    "trending-up": "📈",
    "eye-off": "👁️",
    link: "🔗",
    palette: "🎨",
    filter: "🔍",
    tag: "🏷️",
    folder: "📁",
  };
  return iconMap[icon] || "📌";
}

async function createSmartCollectionFromSuggestion(
  collectionJson: string,
): Promise<void> {
  try {
    const collection = JSON.parse(collectionJson);

    const response = await api("/smart-collections/create", {
      method: "POST",
      body: JSON.stringify(collection),
    });

    if (response.id) {
      showToast(`Created collection: ${collection.name}`, "success");
      loadFolders();
      const suggestionsEl = document.getElementById(
        "smart-collections-suggestions",
      );
      if (suggestionsEl) suggestionsEl.style.display = "none";
    }
  } catch (err: unknown) {
    showToast(
      `Failed to create collection: ${(err as Error).message}`,
      "error",
    );
  }
}

// ============== SMART INSIGHTS WIDGET ==============

async function loadSmartInsights() {
  // Don't load if not authenticated
  const AM = getAPI();
  if (!AM.isAuthenticated || !AM.isAuthenticated()) return;

  try {
    const insights = await api("/smart-insights");
    renderSmartInsights(insights);
  } catch (err) {
    console.error("Failed to load smart insights:", err);
  }
}

/**
 * @deprecated Direct DOM manipulation - convert to SmartInsights React component.
 * Should use React Context to manage insights data and render as a proper component.
 */
function renderSmartInsights(insights: SmartInsights): void {
  const container = document.getElementById("smart-insights-widget");
  if (!container || !insights) return;

  container.innerHTML = `
    <div class="smart-insights-widget">
      <h3>📊 Your Bookmark Insights</h3>
      
      <div class="insights-row">
        <div class="insight-stat">
          <span class="insight-label">Total Bookmarks</span>
          <span class="insight-value">${insights.total_bookmarks || 0}</span>
        </div>
        <div class="insight-stat">
          <span class="insight-label">Tags</span>
          <span class="insight-value">${insights.total_tags || 0}</span>
        </div>
        <div class="insight-stat">
          <span class="insight-label">Total Clicks</span>
          <span class="insight-value">${insights.engagement?.total_clicks || 0}</span>
        </div>
      </div>

      ${
        insights.top_domains?.length > 0
          ? `
        <div class="insights-section">
          <h4>Top Domains</h4>
          <div class="insights-list">
            ${insights.top_domains
              .slice(0, 5)
              .map(
                (d: { domain: string; percentage: number; count: number }) => `
              <div class="insight-item">
                <span class="item-name">${escapeHtml(d.domain)}</span>
                <div class="item-bar">
                  <div class="bar-fill" style="width:${d.percentage || 0}%"></div>
                </div>
                <span class="item-count">${d.count}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      ${
        insights.top_tags?.length > 0
          ? `
        <div class="insights-section">
          <h4>Top Tags</h4>
          <div class="insights-tags">
            ${insights.top_tags
              .slice(0, 8)
              .map(
                (t: { tag: string; count: number }) => `
              <span class="tag-badge-small" title="${t.count} bookmarks">
                ${escapeHtml(t.tag)} (${t.count})
              </span>
            `,
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      ${
        insights.recent_activity
          ? `
        <div class="insights-section">
          <h4>📈 Activity</h4>
          <div class="insights-stats">
            <div class="stat-row">
              <span>This Week</span>
              <strong>${insights.recent_activity.bookmarks_this_week || 0}</strong>
            </div>
            <div class="stat-row">
              <span>This Month</span>
              <strong>${insights.recent_activity.bookmarks_this_month || 0}</strong>
            </div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// ============== DOMAIN STATISTICS ==============

async function showDomainStats(domain: string): Promise<void> {
  try {
    const stats = await api(
      `/smart-collections/domain-stats?domain=${encodeURIComponent(domain)}`,
    );
    displayDomainStatsModal(stats);
  } catch (err: unknown) {
    showToast(
      `Failed to load domain stats: ${(err as Error).message}`,
      "error",
    );
  }
}

/**
 * @deprecated Direct DOM manipulation - should use React modal system.
 * Convert to use ModalContext and create a DomainStatsModal React component.
 */
function displayDomainStatsModal(stats: DomainStats): void {
  if (!stats) return;

  const modal = document.createElement("div");
  modal.className = "modal smart-stats-modal";
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>📊 ${escapeHtml(stats.domain)} Statistics</h2>
        <button class="modal-close btn-icon" aria-label="Close">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Total Bookmarks</span>
            <span class="stat-value">${stats.bookmark_count || 0}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Recent (7 days)</span>
            <span class="stat-value">${stats.recentBookmarks || 0}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Category</span>
            <span class="stat-value">${escapeHtml(stats.category || "General")}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Close handlers
  modal
    .querySelector(".modal-close")
    ?.addEventListener("click", () => modal.remove());
  modal
    .querySelector(".modal-backdrop")
    ?.addEventListener("click", () => modal.remove());

  document.body.appendChild(modal);
  modal.classList.add("show");
}

// ============== INITIALIZATION ==============

export function init() {
  const bookmarkUrlInput = document.getElementById("bookmark-url");

  // Attach smart tag suggestions to URL input
  if (bookmarkUrlInput) {
    bookmarkUrlInput.addEventListener("input", (e: Event) =>
      showSmartTagSuggestions((e.target as HTMLInputElement).value),
    );
  }

  // Load smart collections on dashboard (don't block)
  setTimeout(async () => {
    await loadSmartCollections();
    // Add a small delay between calls to be polite
    setTimeout(loadSmartInsights, 500);
  }, 1000);
}

// Named exports
export {
  showSmartTagSuggestions,
  loadSmartCollections,
  loadSmartInsights,
  showDomainStats,
};

// Default export
export default {
  init,
  showSmartTagSuggestions,
  loadSmartCollections,
  loadSmartInsights,
  showDomainStats,
};
