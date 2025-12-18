/**
 * Smart Organization Frontend Components
 *
 * This module provides smart tag suggestions, collection recommendations,
 * and bookmark insights using the AnchorMarks API.
 */

// Get reference to main app API
function getAPI(): any {
  return (window as any).AnchorMarks || window;
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
  const AM = getAPI();
  if (AM.addTagToInput) {
    AM.addTagToInput(tag);
  } else {
    const input = document.getElementById("bookmark-tags") as HTMLInputElement;
    if (input) {
      const current = input.value
        ? input.value.split(",").map((t) => t.trim())
        : [];
      if (!current.includes(tag)) {
        current.push(tag);
        input.value = current.join(", ");
      }
    }
  }
}

function loadFolders(): void {
  const AM = getAPI();
  if (AM.loadFolders) AM.loadFolders();
}

// ============== SMART TAG SUGGESTIONS ==============

let smartTagSuggestTimeout: ReturnType<typeof setTimeout> | undefined;

async function showSmartTagSuggestions(url: string): Promise<void> {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions || !url) {
    renderTagSuggestions([]);
    return;
  }

  clearTimeout(smartTagSuggestTimeout);
  smartTagSuggestTimeout = setTimeout(async () => {
    try {
      const response = await api(
        `/tags/suggest-smart?url=${encodeURIComponent(url)}&limit=8`,
      );

      if (response.suggestions && response.suggestions.length > 0) {
        renderSmartTagSuggestions(response.suggestions, response.domain_info);
      } else {
        renderTagSuggestions([]);
      }

      // Try AI suggestions (optional)
      const AM = getAPI();
      const aiAllowed = AM.aiSuggestionsEnabled !== false;
      if (aiAllowed) {
        try {
          const ai = await api(
            `/tags/suggest-ai?url=${encodeURIComponent(url)}&limit=6`,
          );
          if (ai && ai.suggestions && ai.suggestions.length) {
            appendAISuggestions(ai.suggestions);
          }
        } catch (aiErr) {
          // Ignore if not configured or failed
        }
      }
    } catch (err) {
      console.error("Smart tag suggestions failed:", err);
      renderTagSuggestions([]);
    }
  }, 400);
}

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

function renderSmartTagSuggestions(suggestions: any[], domainInfo: any): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions) return;

  if (!suggestions || suggestions.length === 0) {
    tagSuggestions.innerHTML =
      '<span class="text-tertiary" style="font-size:0.85rem;">No suggestions</span>';
    return;
  }

  const html = suggestions
    .map((sugg: any) => {
      const sourceIcon =
        ({
          domain: "🌐",
          activity: "📊",
          similar: "🔗",
        } as Record<string, string>)[sugg.source] || "✨";

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
    infoEl.innerHTML = `
      📌 ${domainInfo.bookmark_count} bookmarks from ${escapeHtml(domainInfo.domain)}
      ${domainInfo.category ? ` • ${escapeHtml(domainInfo.category)}` : ""}
    `;
    tagSuggestions.appendChild(infoEl);
  }
}

function appendAISuggestions(suggestions: any[]): void {
  const tagSuggestions = document.getElementById("tag-suggestions");
  if (!tagSuggestions || !suggestions || !suggestions.length) return;

  const header = document.createElement("div");
  header.className = "text-tertiary";
  header.style.cssText = "font-size:0.8rem; margin-top:8px;";
  header.textContent = "🤖 AI Suggestions";
  tagSuggestions.appendChild(header);

  const html = suggestions
    .map((sugg: any) => {
      const name = typeof sugg === "string" ? sugg : sugg.tag;
      return `
        <div class="smart-tag-suggestion" data-tag="${escapeHtml(name)}" title="AI-generated">
          <button type="button" class="tag-suggestion-btn">
            <span class="source-icon">🤖</span>
            <span class="tag-name">${escapeHtml(name)}</span>
          </button>
        </div>
      `;
    })
    .join("");

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  tagSuggestions.appendChild(wrapper);

  wrapper.querySelectorAll(".tag-suggestion-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const container = btn.closest(".smart-tag-suggestion") as HTMLElement;
      if (container) {
        addTagToInput(container.dataset.tag || "");
      }
    });
  });
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

function renderSmartCollectionSuggestions(collections: any[]): void {
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
          ${coll.tags
            ? `
              <div class="collection-tags">
                ${coll.tags
              .slice(0, 3)
              .map((t: string) => `<span class="tag-badge">${escapeHtml(t)}</span>`)
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
      createSmartCollectionFromSuggestion((btn as HTMLElement).dataset.collection || "");
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

async function createSmartCollectionFromSuggestion(collectionJson: string): Promise<void> {
  try {
    const collection = JSON.parse(collectionJson);

    const response = await api("/smart-collections/create", {
      method: "POST",
      body: JSON.stringify(collection),
    });

    if (response.id) {
      showToast(`Created collection: ${collection.name}`, "success");
      loadFolders();
      const suggestionsEl = document.getElementById("smart-collections-suggestions");
      if (suggestionsEl) suggestionsEl.style.display = "none";
    }
  } catch (err: any) {
    showToast(`Failed to create collection: ${err.message}`, "error");
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

function renderSmartInsights(insights: any): void {
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

      ${insights.top_domains?.length > 0
      ? `
        <div class="insights-section">
          <h4>Top Domains</h4>
          <div class="insights-list">
            ${insights.top_domains
        .slice(0, 5)
        .map(
          (d: any) => `
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

      ${insights.top_tags?.length > 0
      ? `
        <div class="insights-section">
          <h4>Top Tags</h4>
          <div class="insights-tags">
            ${insights.top_tags
        .slice(0, 8)
        .map(
          (t: any) => `
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

      ${insights.recent_activity
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
  } catch (err: any) {
    showToast(`Failed to load domain stats: ${err.message}`, "error");
  }
}

function displayDomainStatsModal(stats: any): void {
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
    bookmarkUrlInput.addEventListener("input", (e: Event) => {
      showSmartTagSuggestions((e.target as HTMLInputElement).value);
    });
  }

  // Load smart collections on dashboard (don't block)
  setTimeout(() => {
    loadSmartCollections();
    loadSmartInsights();
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
