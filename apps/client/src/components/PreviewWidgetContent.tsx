import { Icon } from "./Icon.tsx";
import type { Bookmark } from "../types/index";

interface PreviewWidgetContentProps {
  bookmarks: Bookmark[];
}

export function PreviewWidgetContent({ bookmarks }: PreviewWidgetContentProps) {
  if (!bookmarks.length) {
    return (
      <div
        style={{
          padding: "1rem",
          textAlign: "center",
          color: "var(--text-secondary)",
        }}
      >
        No bookmarks
      </div>
    );
  }

  return (
    <div className="compact-list">
      {bookmarks.map((bookmark) => {
        const hasColorClass = bookmark.color ? "has-custom-color" : "";
        const colorStyle = bookmark.color
          ? {
              ["--bookmark-color" as string]: bookmark.color,
              backgroundColor: `color-mix(in srgb, ${bookmark.color} 20%, var(--bg-primary))`,
              borderLeft: `6px solid ${bookmark.color}`,
            }
          : {};

        return (
          <div
            key={bookmark.id}
            className={`compact-item ${hasColorClass}`}
            data-bookmark-id={bookmark.id}
            style={colorStyle}
          >
            <a
              className="compact-item-link"
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              title={bookmark.title || bookmark.url}
            >
              <span className="compact-favicon">
                {bookmark.favicon?.startsWith("/favicons/") ? (
                  <img src={bookmark.favicon} alt="" />
                ) : (
                  <span className="favicon-placeholder">🔗</span>
                )}
              </span>
              <span className="compact-text">
                {bookmark.title || bookmark.url}
              </span>
            </a>
            <div className="compact-actions">
              <button
                type="button"
                className="compact-action-btn"
                title="Edit bookmark"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Implement edit
                }}
              >
                <Icon name="edit" size={12} />
              </button>
              <button
                type="button"
                className={`compact-action-btn ${bookmark.is_favorite ? "compact-action-favorite" : ""}`}
                title={
                  bookmark.is_favorite
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Implement favorite toggle
                }}
              >
                <Icon
                  name={bookmark.is_favorite ? "star-filled" : "star"}
                  size={12}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
