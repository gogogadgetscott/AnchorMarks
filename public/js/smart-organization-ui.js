/**
 * Smart Organization Frontend Components
 * 
 * Add these functions to public/js/app.js
 * 
 * Usage:
 * 1. Call showSmartTagSuggestions() when URL is entered in add bookmark modal
 * 2. Call loadSmartCollections() on dashboard load
 * 3. Call showSmartInsights() for dashboard widget
 */

// ============== SMART TAG SUGGESTIONS ==============

/**
 * Get smart tag suggestions for a URL
 * Called when user enters/changes URL in bookmark form
 */
let smartTagSuggestTimeout;
async function showSmartTagSuggestions(url) {
  if (!tagSuggestions || !url) {
    renderTagSuggestions([]);
    return;
  }

  clearTimeout(smartTagSuggestTimeout);
  smartTagSuggestTimeout = setTimeout(async () => {
    try {
      const response = await api(`/tags/suggest-smart?url=${encodeURIComponent(url)}&limit=8`);
      
      if (response.suggestions && response.suggestions.length > 0) {
        renderSmartTagSuggestions(response.suggestions, response.domain_info);
      } else {
        renderTagSuggestions([]);
      }
    } catch (err) {
      renderTagSuggestions([]);
    }
  }, 400);
}

/**
 * Render smart tag suggestions with source indicators
 */
function renderSmartTagSuggestions(suggestions, domainInfo) {
  if (!tagSuggestions) return;
  
  if (!suggestions || suggestions.length === 0) {
    tagSuggestions.innerHTML = '<span class="text-tertiary" style="font-size:0.85rem;">No suggestions</span>';
    return;
  }

  const html = suggestions.map(sugg => {
    const sourceIcon = {
      'domain': '🌐',
      'activity': '📊',
      'similar': '🔗'
    }[sugg.source] || '✨';
    
    return `
      <div class="smart-tag-suggestion" data-tag="${escapeHtml(sugg.tag)}" title="${escapeHtml(sugg.reason)}">
        <button type="button" class="tag-suggestion-btn">
          <span class="source-icon">${sourceIcon}</span>
          <span class="tag-name">${escapeHtml(sugg.tag)}</span>
          <span class="tag-score">${Math.round(sugg.score * 100)}%</span>
        </button>
        <span class="suggestion-reason text-tertiary" style="font-size:0.75rem;">
          ${escapeHtml(sugg.reason)}
        </span>
      </div>
    `;
  }).join('');

  tagSuggestions.innerHTML = html;

  // Add click handlers
  tagSuggestions.querySelectorAll('.tag-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.closest('.smart-tag-suggestion').dataset.tag;
      addTagToInput(tag);
    });
  });
  
  // Add hover info
  if (domainInfo && domainInfo.domain) {
    const infoEl = document.createElement('div');
    infoEl.className = 'domain-info-mini text-tertiary';
    infoEl.style.cssText = 'font-size:0.75rem; margin-top:8px; padding-top:8px; border-top:1px solid var(--color-border);';
    infoEl.innerHTML = `
      📌 ${domainInfo.bookmark_count} bookmarks from ${domainInfo.domain}
      ${domainInfo.category ? ` • ${domainInfo.category}` : ''}
    `;
    tagSuggestions.appendChild(infoEl);
  }
}

// ============== SMART COLLECTIONS ==============

/**
 * Load and display smart collection suggestions
 */
async function loadSmartCollections() {
  try {
    const response = await api('/smart-collections/suggest?limit=5');
    
    if (response.collections && response.collections.length > 0) {
      renderSmartCollectionSuggestions(response.collections);
    }
  } catch (err) {
    console.error('Failed to load smart collections:', err);
  }
}

/**
 * Render smart collection suggestions in UI
 */
function renderSmartCollectionSuggestions(collections) {
  const container = document.getElementById('smart-collections-suggestions');
  if (!container) return;

  if (!collections || collections.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div class="smart-collections-header">
      <h3>✨ Smart Collections</h3>
      <span class="close-smart-collections" onclick="document.getElementById('smart-collections-suggestions').style.display='none'">✕</span>
    </div>
    <div class="smart-collections-list">
      ${collections.map(coll => `
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
            <span class="collection-type">${coll.type}</span>
          </div>
          ${coll.tags ? `
            <div class="collection-tags">
              ${coll.tags.slice(0, 3).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('')}
              ${coll.tags.length > 3 ? `<span class="tag-badge more">+${coll.tags.length - 3}</span>` : ''}
            </div>
          ` : ''}
          <button class="btn-secondary" onclick="createSmartCollectionFromSuggestion('${escapeHtml(JSON.stringify(coll))}')">
            Create Collection
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Get emoji icon for collection type
 */
function getCollectionIcon(icon) {
  const iconMap = {
    'clock': '🕐',
    'trending-up': '📈',
    'eye-off': '👁️',
    'link': '🔗',
    'palette': '🎨',
    'filter': '🔍',
    'tag': '🏷️',
    'folder': '📁'
  };
  return iconMap[icon] || '📌';
}

/**
 * Create a smart collection from suggestion
 */
async function createSmartCollectionFromSuggestion(collectionJson) {
  try {
    const collection = JSON.parse(decodeURIComponent(collectionJson));
    
    const response = await api('/smart-collections/create', {
      method: 'POST',
      body: JSON.stringify(collection)
    });
    
    if (response.id) {
      showToast(`Created collection: ${collection.name}`, 'success');
      // Reload collections to include new one
      loadFolders();
      // Hide suggestions
      document.getElementById('smart-collections-suggestions').style.display = 'none';
    }
  } catch (err) {
    showToast(`Failed to create collection: ${err.message}`, 'error');
  }
}

// ============== SMART INSIGHTS WIDGET ==============

/**
 * Load and display smart insights dashboard
 */
async function loadSmartInsights() {
  try {
    const insights = await api('/smart-insights');
    renderSmartInsights(insights);
  } catch (err) {
    console.error('Failed to load smart insights:', err);
  }
}

/**
 * Render smart insights widget
 */
function renderSmartInsights(insights) {
  const container = document.getElementById('smart-insights-widget');
  if (!container) return;

  container.innerHTML = `
    <div class="smart-insights-widget">
      <h3>📊 Your Bookmark Insights</h3>
      
      <div class="insights-row">
        <div class="insight-stat">
          <span class="insight-label">Total Bookmarks</span>
          <span class="insight-value">${insights.total_bookmarks}</span>
        </div>
        <div class="insight-stat">
          <span class="insight-label">Tags</span>
          <span class="insight-value">${insights.total_tags}</span>
        </div>
        <div class="insight-stat">
          <span class="insight-label">Total Clicks</span>
          <span class="insight-value">${insights.engagement.total_clicks}</span>
        </div>
      </div>

      <div class="insights-section">
        <h4>Top Domains</h4>
        <div class="insights-list">
          ${insights.top_domains.slice(0, 5).map(d => `
            <div class="insight-item">
              <span class="item-name">${escapeHtml(d.domain)}</span>
              <div class="item-bar">
                <div class="bar-fill" style="width:${d.percentage}%"></div>
              </div>
              <span class="item-count">${d.count}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="insights-section">
        <h4>Top Tags</h4>
        <div class="insights-tags">
          ${insights.top_tags.slice(0, 8).map(t => `
            <span class="tag-badge-small" title="${t.count} bookmarks">
              ${escapeHtml(t.tag)} (${t.count})
            </span>
          `).join('')}
        </div>
      </div>

      <div class="insights-section">
        <h4>📈 Activity</h4>
        <div class="insights-stats">
          <div class="stat-row">
            <span>This Week</span>
            <strong>${insights.recent_activity.bookmarks_this_week}</strong>
          </div>
          <div class="stat-row">
            <span>This Month</span>
            <strong>${insights.recent_activity.bookmarks_this_month}</strong>
          </div>
          <div class="stat-row">
            <span>Unread</span>
            <strong>${insights.engagement.unread_bookmarks}</strong>
          </div>
          <div class="stat-row">
            <span>Frequently Used</span>
            <strong>${insights.engagement.frequently_used}</strong>
          </div>
        </div>
      </div>

      ${insights.suggestions.create_these_collections && insights.suggestions.create_these_collections.length > 0 ? `
        <div class="insights-section">
          <h4>💡 Suggested Collections</h4>
          <div class="suggestions-list">
            ${insights.suggestions.create_these_collections.slice(0, 3).map(s => `
              <button class="suggestion-btn" onclick="createSmartCollectionFromSuggestion('${escapeHtml(JSON.stringify(s))}')">
                ${getCollectionIcon(s.icon)} ${escapeHtml(s.name)}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ============== DOMAIN STATISTICS ==============

/**
 * Get detailed statistics for a domain
 */
async function showDomainStats(domain) {
  try {
    const stats = await api(`/smart-collections/domain-stats?domain=${encodeURIComponent(domain)}`);
    displayDomainStatsModal(stats);
  } catch (err) {
    showToast(`Failed to load domain stats: ${err.message}`, 'error');
  }
}

/**
 * Display domain statistics in modal
 */
function displayDomainStatsModal(stats) {
  const modal = document.createElement('div');
  modal.className = 'modal smart-stats-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>📊 ${escapeHtml(stats.domain)} Statistics</h2>
        <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Total Bookmarks</span>
            <span class="stat-value">${stats.bookmark_count}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Recent (7 days)</span>
            <span class="stat-value">${stats.recentBookmarks}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Category</span>
            <span class="stat-value">${stats.category || 'General'}</span>
          </div>
        </div>

        <div class="stats-section">
          <h3>Tag Distribution</h3>
          <div class="tag-distribution">
            ${Object.entries(stats.tagDistribution).slice(0, 10).map(([tag, count]) => `
              <div class="tag-dist-item">
                <span class="tag-name">${escapeHtml(tag)}</span>
                <div class="tag-bar">
                  <div class="bar-fill" style="width:${(count / Math.max(...Object.values(stats.tagDistribution))) * 100}%"></div>
                </div>
                <span class="tag-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        ${stats.mostClicked && stats.mostClicked.length > 0 ? `
          <div class="stats-section">
            <h3>Most Clicked</h3>
            <div class="most-clicked">
              ${stats.mostClicked.map(b => `
                <div class="clicked-item">
                  <span class="clicked-title">${escapeHtml(b.title)}</span>
                  <span class="clicked-count">👆 ${b.click_count}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ============== INITIALIZATION ==============

/**
 * Initialize smart organization features
 * Call this after page loads
 */
function initSmartOrganization() {
  // Update the bookmarkUrlInput event listener to call smart suggestions
  if (bookmarkUrlInput) {
    bookmarkUrlInput.addEventListener('change', () => {
      showSmartTagSuggestions(bookmarkUrlInput.value);
    });
  }
  
  // Load smart collections on dashboard
  loadSmartCollections();
  
  // Load smart insights
  loadSmartInsights();
}

/**
 * Add CSS styles for smart organization UI
 * Add to public/css/styles.css
 */
const SMART_ORG_STYLES = `
.smart-tag-suggestion {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  transition: all 0.2s;
}

.smart-tag-suggestion:hover {
  background: var(--color-accent-light);
  border-color: var(--color-accent);
}

.tag-suggestion-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  text-align: left;
}

.source-icon {
  font-size: 1.1em;
}

.tag-score {
  margin-left: auto;
  font-weight: bold;
  color: var(--color-accent);
  font-size: 0.85em;
}

.suggestion-reason {
  line-height: 1.3;
  white-space: pre-wrap;
}

.domain-info-mini {
  display: flex;
  align-items: center;
  gap: 8px;
}

.smart-collections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--color-accent);
}

.smart-collection-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  transition: all 0.2s;
}

.smart-collection-card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.collection-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.collection-icon {
  flex-shrink: 0;
}

.collection-info {
  flex: 1;
}

.collection-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.collection-reason {
  margin: 4px 0 0;
  font-size: 0.85rem;
}

.collection-meta {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.collection-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.tag-badge {
  display: inline-block;
  padding: 4px 8px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.tag-badge.more {
  background: none;
  color: var(--color-text-secondary);
  padding: 0;
}

.smart-insights-widget {
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.insights-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.insight-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
  text-align: center;
}

.insight-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.insight-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-accent);
}

.insights-section {
  margin-bottom: 20px;
}

.insights-section h4 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 600;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-name {
  flex-shrink: 0;
  width: 120px;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  overflow: hidden;
}

.item-bar {
  flex: 1;
  height: 20px;
  background: var(--color-bg-primary);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-light));
}

.item-count {
  flex-shrink: 0;
  width: 40px;
  text-align: right;
  font-size: 0.9rem;
  font-weight: 500;
}

.insights-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag-badge-small {
  display: inline-block;
  padding: 6px 10px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.insights-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: var(--color-bg-primary);
  border-radius: 4px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-btn {
  padding: 10px 12px;
  background: var(--color-accent-light);
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.suggestion-btn:hover {
  background: var(--color-accent);
  color: white;
}

.smart-stats-modal .modal-content {
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  text-align: center;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: var(--color-accent);
}

.tag-distribution {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tag-dist-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-name {
  flex-shrink: 0;
  width: 100px;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  overflow: hidden;
}

.tag-bar {
  flex: 1;
  height: 24px;
  background: var(--color-bg-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.tag-count {
  flex-shrink: 0;
  width: 50px;
  text-align: right;
  font-weight: 500;
}

.most-clicked {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.clicked-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  border-left: 3px solid var(--color-accent);
}

.clicked-title {
  flex: 1;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.clicked-count {
  flex-shrink: 0;
  font-weight: bold;
  color: var(--color-accent);
}
`;

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showSmartTagSuggestions,
    loadSmartCollections,
    loadSmartInsights,
    initSmartOrganization
  };
}
