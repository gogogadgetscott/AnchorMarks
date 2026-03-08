import { useSmartInsights } from "@hooks/useSmartInsights";

interface SmartInsightsProps {
  enabled?: boolean;
}

/**
 * Component that displays comprehensive bookmark insights and analytics
 */
export function SmartInsights({ enabled = true }: SmartInsightsProps) {
  const { insights, isLoading, error } = useSmartInsights(enabled);

  // Loading state
  if (isLoading) {
    return (
      <div className="smart-insights-widget" id="smart-insights-widget">
        <h3>📊 Your Bookmark Insights</h3>
        <div className="text-tertiary">
          <span className="loading-dots">
            Loading insights
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="smart-insights-widget" id="smart-insights-widget">
        <h3>📊 Your Bookmark Insights</h3>
        <div className="text-tertiary" style={{ fontSize: "0.85rem" }}>
          Error: {error}
        </div>
      </div>
    );
  }

  // No insights
  if (!insights) {
    return (
      <div className="smart-insights-widget" id="smart-insights-widget">
        <h3>📊 Your Bookmark Insights</h3>
        <div className="text-tertiary" style={{ fontSize: "0.85rem" }}>
          No insights available
        </div>
      </div>
    );
  }

  return (
    <div className="smart-insights-widget" id="smart-insights-widget">
      <h3>📊 Your Bookmark Insights</h3>

      {/* Top Stats Row */}
      <div className="insights-row">
        <div className="insight-stat">
          <span className="insight-label">Total Bookmarks</span>
          <span className="insight-value">{insights.total_bookmarks || 0}</span>
        </div>
        <div className="insight-stat">
          <span className="insight-label">Tags</span>
          <span className="insight-value">{insights.total_tags || 0}</span>
        </div>
        <div className="insight-stat">
          <span className="insight-label">Total Clicks</span>
          <span className="insight-value">
            {insights.engagement?.total_clicks || 0}
          </span>
        </div>
      </div>

      {/* Top Domains */}
      {insights.top_domains && insights.top_domains.length > 0 && (
        <div className="insights-section">
          <h4>Top Domains</h4>
          <div className="insights-list">
            {insights.top_domains.slice(0, 5).map((domain: { domain: string; count: number; percentage?: number }) => (
              <div key={domain.domain} className="insight-item">
                <span className="item-name">{domain.domain}</span>
                <div className="item-bar">
                  <div
                    className="bar-fill"
                    style={{ width: `${domain.percentage || 0}%` }}
                  />
                </div>
                <span className="item-count">{domain.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Tags */}
      {insights.top_tags && insights.top_tags.length > 0 && (
        <div className="insights-section">
          <h4>Top Tags</h4>
          <div className="insights-tags">
            {insights.top_tags.slice(0, 8).map((tagObj: { tag: string; count: number }) => (
              <span
                key={tagObj.tag}
                className="tag-badge-small"
                title={`${tagObj.count} bookmarks`}
              >
                {tagObj.tag} ({tagObj.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {insights.recent_activity && (
        <div className="insights-section">
          <h4>📈 Activity</h4>
          <div className="insights-stats">
            <div className="stat-row">
              <span>This Week</span>
              <strong>{insights.recent_activity.bookmarks_this_week || 0}</strong>
            </div>
            <div className="stat-row">
              <span>This Month</span>
              <strong>{insights.recent_activity.bookmarks_this_month || 0}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {insights.suggestions &&
        (insights.suggestions.create_these_collections ||
          insights.suggestions.tags_to_cleanup) && (
          <div className="insights-section">
            <h4>💡 Suggestions</h4>
            {insights.suggestions.create_these_collections &&
              insights.suggestions.create_these_collections.length > 0 && (
                <div className="suggestion-item">
                  <strong>Create Collections:</strong>
                  <ul>
                    {insights.suggestions.create_these_collections.map((coll: string) => (
                      <li key={coll}>{coll}</li>
                    ))}
                  </ul>
                </div>
              )}
            {insights.suggestions.tags_to_cleanup &&
              insights.suggestions.tags_to_cleanup.length > 0 && (
                <div className="suggestion-item">
                  <strong>Tags to Cleanup:</strong>
                  <ul>
                    {insights.suggestions.tags_to_cleanup.map((tag: string) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
    </div>
  );
}
