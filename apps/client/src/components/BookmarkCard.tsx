import React, { memo, useCallback } from 'react';
import { Icon } from './Icon';
import { Badge } from './Badge';
import { useAppState } from '../contexts/AppContext';
import type { Bookmark as BookmarkType } from '../types';

interface BookmarkCardProps {
  bookmark: BookmarkType;
  index?: number;
  viewMode?: 'grid' | 'list' | 'compact';
  isSelected?: boolean;
  onEdit?: (bookmark: BookmarkType) => void;
  onDelete?: (bookmarkId: string) => void;
  onToggleFavorite?: (bookmarkId: string) => void;
}

const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

const getBaseUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    return url;
  }
};

export const BookmarkCard = memo<BookmarkCardProps>(({
  bookmark,
  index,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const { selectedBookmarks, toggleBookmarkSelection, viewMode, hideFavicons, tagMetadata } = useAppState();
  
  const isSelected = selectedBookmarks.has(bookmark.id);
  const hostname = getHostname(bookmark.url);
  const baseUrl = getBaseUrl(bookmark.url);
  const displayUrl = viewMode === 'list' ? baseUrl : hostname;

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleBookmarkSelection(bookmark.id);
    }
  }, [bookmark.id, toggleBookmarkSelection]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmarkSelection(bookmark.id);
  }, [bookmark.id, toggleBookmarkSelection]);

  const handleOpenLink = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(bookmark.url, '_blank', 'noopener,noreferrer');
  }, [bookmark.url]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(bookmark);
  }, [bookmark, onEdit]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(bookmark.id);
  }, [bookmark.id, onDelete]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(bookmark.id);
  }, [bookmark.id, onToggleFavorite]);

  const tags = bookmark.tags_detailed || [];

  return (
    <div
      className={`bookmark-card ${viewMode} ${isSelected ? 'selected' : ''}`}
      data-bookmark-id={bookmark.id}
      data-index={index}
      onClick={handleCardClick}
      style={bookmark.color ? { borderLeftColor: bookmark.color } : undefined}
    >
      <div className="bookmark-checkbox-container">
        <input
          type="checkbox"
          className="bookmark-checkbox"
          checked={isSelected}
          onChange={handleCheckboxClick}
          onClick={handleCheckboxClick}
        />
      </div>

      {!hideFavicons && bookmark.favicon && (
        <div className="bookmark-favicon">
          <img
            src={bookmark.favicon}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="bookmark-content">
        <div className="bookmark-header">
          <h3 className="bookmark-title">{bookmark.title || 'Untitled'}</h3>
          <div className="bookmark-actions">
            <button
              className="btn-icon"
              onClick={handleToggleFavorite}
              title={bookmark.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={bookmark.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Icon name={bookmark.is_favorite ? 'star' : 'star-outline'} size={16} />
            </button>
            <button
              className="btn-icon"
              onClick={handleEditClick}
              title="Edit bookmark"
              aria-label="Edit bookmark"
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              className="btn-icon"
              onClick={handleDeleteClick}
              title="Delete bookmark"
              aria-label="Delete bookmark"
            >
              <Icon name="delete" size={16} />
            </button>
          </div>
        </div>

        {bookmark.description && (
          <p className="bookmark-description">{bookmark.description}</p>
        )}

        <div className="bookmark-meta">
          <a
            href={bookmark.url}
            className="bookmark-url"
            onClick={handleOpenLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="link" size={14} />
            <span>{displayUrl}</span>
          </a>
        </div>

        {tags.length > 0 && (
          <div className="bookmark-tags">
            {tags.map((tag) => {
              const tagMeta = tagMetadata[tag.name] || {};
              const tagColor = tag.color_override || tag.color || tagMeta.color || '#64748b';
              
              return (
                <Badge
                  key={tag.name}
                  variant="secondary"
                  style={{ backgroundColor: tagColor }}
                >
                  {tag.name}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

BookmarkCard.displayName = 'BookmarkCard';
