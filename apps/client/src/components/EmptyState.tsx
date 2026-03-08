import { useUI } from "@contexts/UIContext";
import { useBookmarks } from "@contexts/BookmarksContext";
import { Icon } from "./Icon.tsx";

export function EmptyState() {
  const { currentView, currentFolder } = useUI();
  const { renderedBookmarks, filterConfig } = useBookmarks();
  const searchQuery = filterConfig.search;

  if (renderedBookmarks.length > 0) return null;

  const renderContent = () => {
    if (currentView === "favorites") {
      return (
        <div className="empty-state-content">
          <Icon
            name="star"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--primary-400)" }}
          />
          <h3>You haven't added any favorites yet</h3>
          <p>
            Click the star icon{" "}
            <span style={{ color: "var(--primary-400)" }}>⭐</span> on any
            bookmark
            <br />
            to mark it as favorite.
          </p>
        </div>
      );
    }

    if (currentView === "archived") {
      return (
        <div className="empty-state-content">
          <Icon
            name="archive"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--text-tertiary)" }}
          />
          <h3>No archived bookmarks</h3>
          <p>
            Archived bookmarks are hidden from your main view.
            <br />
            Use the archive action on any bookmark to add it here.
          </p>
        </div>
      );
    }

    if (currentView === "recent") {
      return (
        <div className="empty-state-content">
          <Icon
            name="clock"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--text-tertiary)" }}
          />
          <h3>No recent bookmarks</h3>
          <p>
            Recently clicked bookmarks will appear here.
            <br />
            Start browsing your bookmarks to see them here!
          </p>
        </div>
      );
    }

    if (currentView === "most-used") {
      return (
        <div className="empty-state-content">
          <Icon
            name="activity"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--text-tertiary)" }}
          />
          <h3>No visits yet</h3>
          <p>
            Links you click will appear here, ranked by how often you visit
            them.
          </p>
        </div>
      );
    }

    if (filterConfig.tags.length > 0) {
      return (
        <div className="empty-state-content">
          <Icon
            name="tag"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--text-tertiary)" }}
          />
          <h3>No bookmarks with these tags</h3>
          <p>
            No bookmarks match your selected tags.
            <br />
            <button
              className="btn-link"
              onClick={() => {
                /* TODO: Clear filters */
              }}
            >
              Clear filters
            </button>
          </p>
        </div>
      );
    }

    if (searchQuery) {
      return (
        <div className="empty-state-content">
          <Icon
            name="search"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--text-tertiary)" }}
          />
          <h3>No results found</h3>
          <p>
            No bookmarks match "{searchQuery}".
            <br />
            Try a different search term.
          </p>
        </div>
      );
    }

    if (currentView === "folder" && currentFolder) {
      return (
        <div className="empty-state-content">
          <Icon
            name="folder"
            size={48}
            className="empty-state-icon"
            style={{ color: "var(--text-tertiary)" }}
          />
          <h3>This folder is empty</h3>
          <p>
            Add bookmarks to this folder by clicking
            <br />
            "Add Bookmark" and selecting it.
          </p>
        </div>
      );
    }

    return (
      <div className="empty-state-content">
        <Icon
          name="link"
          size={48}
          className="empty-state-icon"
          style={{ color: "var(--primary-400)" }}
        />
        <h3>No bookmarks yet</h3>
        <p>
          Click "Add Bookmark" to save your first link,
          <br />
          or import bookmarks from your browser.
        </p>
        <button
          className="btn btn-primary"
          style={{ marginTop: "1rem" }}
          onClick={() => {
            import("@utils/modal-controller.ts").then(({ openModal }) => {
              openModal("bookmark-modal");
            });
          }}
        >
          Add Your First Bookmark
        </button>
      </div>
    );
  };

  return (
    <div id="empty-state" className="empty-state">
      {renderContent()}
    </div>
  );
}
