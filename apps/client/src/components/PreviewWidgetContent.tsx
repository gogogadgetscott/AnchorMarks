import type { Bookmark } from "../types/index";

interface PreviewWidgetContentProps {
  bookmarks: Bookmark[];
}

export function PreviewWidgetContent({ bookmarks }: PreviewWidgetContentProps) {
  const previewBookmarks = bookmarks.slice(0, 3);

  if (!previewBookmarks.length) {
    return (
      <p className="widget-empty-state">No bookmarks in this widget yet.</p>
    );
  }

  return (
    <div className="widget-preview-list" role="list">
      {previewBookmarks.map((bookmark) => (
        <article
          className="widget-preview-item"
          key={bookmark.id}
          role="listitem"
        >
          <a
            className="widget-preview-link"
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            title={bookmark.title || bookmark.url}
          >
            {bookmark.title || bookmark.url}
          </a>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            aria-label="Open"
            onClick={() =>
              window.open(bookmark.url, "_blank", "noopener,noreferrer")
            }
          >
            Open
          </button>
        </article>
      ))}
    </div>
  );
}
