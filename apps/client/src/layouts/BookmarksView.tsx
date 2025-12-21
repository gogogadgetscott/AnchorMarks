import React, { memo, useMemo } from "react";
import { BookmarkCard } from "../components/BookmarkCard";
import { EmptyState } from "../components/EmptyState";
import { useAppState } from "../contexts/AppContext";

export const BookmarksView = memo(() => {
  const {
    bookmarks,
    currentView,
    viewMode,
    searchQuery,
    currentFolder,
    currentTag,
    selectedBookmarks,
  } = useAppState();

  const filteredBookmarks = useMemo(() => {
    let filtered = [...bookmarks];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((b) => {
        const tags = b.tags
          ? typeof b.tags === "string"
            ? b.tags
            : JSON.stringify(b.tags)
          : "";
        return (
          b.title?.toLowerCase().includes(query) ||
          b.url?.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query) ||
          tags.toLowerCase().includes(query)
        );
      });
    }

    // Filter by folder
    if (currentFolder && currentFolder !== "all") {
      filtered = filtered.filter((b) => b.folder_id === currentFolder);
    }

    // Filter by tag
    if (currentTag) {
      filtered = filtered.filter((b) => {
        const tags = b.tags
          ? typeof b.tags === "string"
            ? b.tags
            : JSON.stringify(b.tags)
          : "";
        return tags.includes(currentTag);
      });
    }

    // Filter by view
    if (currentView === "favorites") {
      filtered = filtered.filter((b) => b.is_favorite);
    } else if (currentView === "recent") {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(
        (b) => new Date(b.created_at || 0).getTime() > weekAgo,
      );
    } else if (currentView === "archived") {
      filtered = filtered.filter((b) => b.is_archived);
    }

    return filtered;
  }, [bookmarks, searchQuery, currentFolder, currentTag, currentView]);

  if (filteredBookmarks.length === 0) {
    return (
      <div className="bookmarks-content">
        <EmptyState
          icon="list"
          title="No bookmarks found"
          description={
            searchQuery
              ? "Try adjusting your search query"
              : "Add your first bookmark to get started"
          }
          actionLabel={!searchQuery ? "Add Bookmark" : undefined}
          onAction={
            !searchQuery
              ? () => (window as any).AnchorMarks?.showBookmarkModal?.()
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="bookmarks-content">
      <div className={`bookmarks-${viewMode}`}>
        {filteredBookmarks.map((bookmark) => (
          <BookmarkCard
            key={bookmark.id}
            bookmark={bookmark}
            viewMode={viewMode}
            isSelected={selectedBookmarks.has(bookmark.id)}
          />
        ))}
      </div>
    </div>
  );
});

BookmarksView.displayName = "BookmarksView";
