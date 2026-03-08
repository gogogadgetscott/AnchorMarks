import { useSmartTags } from "@hooks/useSmartTags";
import type { SmartTagSuggestion } from "@hooks/useSmartTags";

interface SmartTagSuggestionsProps {
  url: string;
  onTagClick: (tag: string) => void;
  enabled?: boolean;
}

/**
 * Component that displays smart and AI tag suggestions for a given URL
 */
export function SmartTagSuggestions({
  url,
  onTagClick,
  enabled = true,
}: SmartTagSuggestionsProps) {
  const {
    smartSuggestions,
    aiSuggestions,
    domainInfo,
    isLoadingSmart,
    isLoadingAI,
    error,
  } = useSmartTags(url, enabled);

  const handleAddAllAI = () => {
    aiSuggestions.forEach((tag: string) => onTagClick(tag));
  };

  const getSourceIcon = (source: SmartTagSuggestion["source"]): string => {
    const icons: Record<string, string> = {
      domain: "🌐",
      activity: "📊",
      similar: "🔗",
    };
    return icons[source] || "✨";
  };

  // Loading state
  if (isLoadingSmart) {
    return (
      <div className="tag-suggestions" id="tag-suggestions">
        <span className="tag-suggestions-loading text-tertiary">
          <span className="loading-dots">
            Fetching suggestions
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tag-suggestions" id="tag-suggestions">
        <span className="text-tertiary" style={{ fontSize: "0.85rem" }}>
          Error: {error}
        </span>
      </div>
    );
  }

  // No suggestions + not loading AI
  if (smartSuggestions.length === 0 && aiSuggestions.length === 0 && !isLoadingAI) {
    return (
      <div className="tag-suggestions" id="tag-suggestions">
        <span className="text-tertiary" style={{ fontSize: "0.85rem" }}>
          No suggestions
        </span>
      </div>
    );
  }

  return (
    <div className="tag-suggestions" id="tag-suggestions">
      {/* Smart Suggestions */}
      {smartSuggestions.map((sugg: SmartTagSuggestion) => (
        <div
          key={sugg.tag}
          className="smart-tag-suggestion"
          data-tag={sugg.tag}
          title={sugg.reason}
        >
          <button
            type="button"
            className="tag-suggestion-btn"
            onClick={() => onTagClick(sugg.tag)}
          >
            <span className="source-icon">{getSourceIcon(sugg.source)}</span>
            <span className="tag-name">{sugg.tag}</span>
            <span className="tag-score">{Math.round(sugg.score * 100)}%</span>
          </button>
        </div>
      ))}

      {/* Domain Info */}
      {domainInfo && domainInfo.domain && (
        <div
          className="domain-info-mini text-tertiary"
          style={{
            fontSize: "0.75rem",
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          📌 {domainInfo.bookmarkCount ?? domainInfo.bookmark_count ?? 0} bookmarks
          from {domainInfo.domain}
          {domainInfo.category && ` • ${domainInfo.category}`}
        </div>
      )}

      {/* AI Suggestions Loading */}
      {isLoadingAI && (
        <div className="ai-suggestions-header text-tertiary">
          <span>
            🤖 AI thinking
            <span className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        </div>
      )}

      {/* AI Suggestions */}
      {!isLoadingAI && aiSuggestions.length > 0 && (
        <>
          <div className="ai-suggestions-header text-tertiary">
            <span>🤖 AI Suggestions</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                height: "auto",
              }}
              onClick={handleAddAllAI}
            >
              Add All
            </button>
          </div>
          <div className="ai-suggestions-row">
            {aiSuggestions.map((tag: string) => (
              <div
                key={tag}
                className="smart-tag-suggestion"
                data-tag={tag}
                title="AI-generated"
              >
                <button
                  type="button"
                  className="tag-suggestion-btn"
                  onClick={() => onTagClick(tag)}
                >
                  <span className="source-icon">🤖</span>
                  <span className="tag-name">{tag}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
