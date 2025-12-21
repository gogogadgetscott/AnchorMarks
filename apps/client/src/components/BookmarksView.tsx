import React, { useMemo, useCallback } from "react";
import { useAppState } from "../contexts/AppContext";
import { BookmarkCard } from "./BookmarkCard";
import { Header } from "./Header";
import type { Bookmark } from "../types";

/**
 * BookmarksView Component
 * Displays bookmarks in various views (grid, list, compact)
 */
const BookmarksView: React.FC = () => {
  const { bookmarks, viewMode, filterConfig, currentFolder } = useAppState();

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    let filtered = [...bookmarks];

    if (currentFolder) {
      filtered = filtered.filter((b) => b.folder_id === currentFolder);
    }

    if (filterConfig.tags && filterConfig.tags.length > 0) {
      filtered = filtered.filter((bookmark) => {
        const bookmarkTags =
          bookmark.tags?.split(",").map((t) => t.trim()) || [];
        if (filterConfig.tagMode === "AND") {
          return filterConfig.tags.every((tag) => bookmarkTags.includes(tag));
        } else {
          return filterConfig.tags.some((tag) => bookmarkTags.includes(tag));
        }
      });
    }

    switch (filterConfig.sort) {
      case "recently_added":
        filtered.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        );
        break;
      case "most_visited":
        filtered.sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
        break;
      case "a_z":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "z_a":
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return filtered;
  }, [bookmarks, currentFolder, filterConfig]);

  const handleEditBookmark = useCallback((bookmark: Bookmark) => {
    console.log("Edit bookmark:", bookmark);
  }, []);

  const handleDeleteBookmark = useCallback((bookmarkId: string) => {
    console.log("Delete bookmark:", bookmarkId);
  }, []);

  const handleToggleFavorite = useCallback((bookmarkId: string) => {
    console.log("Toggle favorite:", bookmarkId);
  }, []);

  return (
    <div id="bookmarks-view" className="bookmarks-view">
      <Header
        title="Bookmarks"
        count={filteredBookmarks.length}
        countSuffix="bookmarks"
        showViewToggle={true}
      />
      <div
        id="bookmarks-container"
        className={`bookmarks-container ${viewMode}`}
      >
        {filteredBookmarks.length === 0 ? (
          <div className="empty-state">
            <p>No bookmarks found</p>
          </div>
        ) : (
          filteredBookmarks.map((bookmark, index) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              index={index}
              onEdit={handleEditBookmark}
              onDelete={handleDeleteBookmark}
              onToggleFavorite={handleToggleFavorite}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default BookmarksView;
