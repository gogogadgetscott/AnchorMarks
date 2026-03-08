import { useSmartCollections, type SmartCollection } from "@hooks/useSmartCollections";

interface SmartCollectionsProps {
  bookmarkId?: string;
  onCollectionClick?: (collection: SmartCollection) => void;
  enabled?: boolean;
}

/**
 * Component that displays smart collection suggestions
 */
export function SmartCollections({
  bookmarkId,
  onCollectionClick,
  enabled = true,
}: SmartCollectionsProps) {
  const { collections, isLoading, error } = useSmartCollections(bookmarkId, enabled);

  const handleCollectionClick = (collection: SmartCollection) => {
    if (onCollectionClick) {
      onCollectionClick(collection);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="smart-collections">
        <div className="smart-collections-header">
          <h3>📚 Suggested Collections</h3>
        </div>
        <div className="text-tertiary">
          <span className="loading-dots">
            Loading collections
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
      <div className="smart-collections">
        <div className="smart-collections-header">
          <h3>📚 Suggested Collections</h3>
        </div>
        <div className="text-tertiary" style={{ fontSize: "0.85rem" }}>
          Error: {error}
        </div>
      </div>
    );
  }

  // No collections
  if (collections.length === 0) {
    return (
      <div className="smart-collections">
        <div className="smart-collections-header">
          <h3>📚 Suggested Collections</h3>
        </div>
        <div className="text-tertiary" style={{ fontSize: "0.85rem" }}>
          No collection suggestions available
        </div>
      </div>
    );
  }

  return (
    <div className="smart-collections">
      <div className="smart-collections-header">
        <h3>📚 Suggested Collections</h3>
        <span className="collection-count text-tertiary">
          {collections.length} suggestion{collections.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="smart-collections-list">
        {collections.map((collection: SmartCollection) => (
          <div
            key={collection.id}
            className="smart-collection-card"
            onClick={() => handleCollectionClick(collection)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCollectionClick(collection);
              }
            }}
          >
            <div className="collection-header">
              <h4 className="collection-name">{collection.name}</h4>
              <span className="collection-bookmark-count text-tertiary">
                {collection.count} bookmarks
              </span>
            </div>
            {collection.description && (
              <p className="collection-description text-secondary">
                {collection.description}
              </p>
            )}
            {collection.tags && collection.tags.length > 0 && (
              <div className="collection-tags">
                {collection.tags.map((tag: string) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {collection.query && (
              <div className="collection-query text-tertiary">
                <code>{collection.query}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
