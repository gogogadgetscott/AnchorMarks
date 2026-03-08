export function SkeletonCard() {
  return (
    <div className="bookmark-card skeleton-card">
      <div className="bookmark-header">
        <div className="bookmark-favicon">
          <div className="skeleton skeleton-favicon"></div>
        </div>
        <div className="bookmark-info">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-url"></div>
        </div>
      </div>
      <div className="bookmark-tags">
        <div className="skeleton skeleton-tag"></div>
        <div className="skeleton skeleton-tag"></div>
      </div>
      <div
        className="bookmark-actions"
        style={{ opacity: 0.5, pointerEvents: "none" }}
      >
        <div
          className="skeleton"
          style={{ width: "60px", height: "32px", borderRadius: "4px" }}
        ></div>
        <div
          className="skeleton"
          style={{ width: "60px", height: "32px", borderRadius: "4px" }}
        ></div>
      </div>
    </div>
  );
}
