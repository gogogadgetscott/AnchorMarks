import React, { memo, useMemo, useCallback, useState } from 'react';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useAppState } from '../contexts/AppContext';
import type { Tag } from '../types';

interface TagItemProps {
  tag: Tag;
  onSelect: (tagName: string) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tagId: string) => void;
}

const TagItem = memo<TagItemProps>(({ tag, onSelect, onEdit, onDelete }) => {
  const handleSelect = useCallback(() => {
    onSelect(tag.name);
  }, [tag.name, onSelect]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(tag);
  }, [tag, onEdit]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete tag "${tag.name}"?`)) {
      onDelete(tag.id);
    }
  }, [tag.id, tag.name, onDelete]);

  return (
    <div className="tag-item" onClick={handleSelect}>
      <div className="tag-info">
        <Badge
          variant="secondary"
          size="md"
          style={{ backgroundColor: tag.color || tag.color_override }}
        >
          {tag.name}
        </Badge>
        {tag.count !== undefined && (
          <span className="tag-count">{tag.count} bookmarks</span>
        )}
      </div>
      <div className="tag-actions">
        <button
          className="icon-button"
          onClick={handleEdit}
          title="Edit tag"
        >
          <Icon name="edit" size={16} />
        </button>
        <button
          className="icon-button"
          onClick={handleDelete}
          title="Delete tag"
        >
          <Icon name="delete" size={16} />
        </button>
      </div>
    </div>
  );
});

TagItem.displayName = 'TagItem';

export const TagsView = memo(() => {
  const { tags, filterConfig } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'count'>('count');

  const filteredTags = useMemo(() => {
    let filtered = [...tags];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(query));
    }

    // Sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered.sort((a, b) => (b.count || 0) - (a.count || 0));
    }

    return filtered;
  }, [tags, searchQuery, sortBy]);

  const handleSelectTag = useCallback((tagName: string) => {
    window.AnchorMarks?.filterByTag?.(tagName);
  }, []);

  const handleEditTag = useCallback((tag: Tag) => {
    window.AnchorMarks?.showTagModal?.(tag);
  }, []);

  const handleDeleteTag = useCallback((tagId: string) => {
    window.AnchorMarks?.deleteTag?.(tagId);
  }, []);

  const handleCreateTag = useCallback(() => {
    window.AnchorMarks?.showTagModal?.();
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'name' | 'count');
  }, []);

  if (tags.length === 0) {
    return (
      <div className="tags-content">
        <EmptyState
          icon="tag"
          title="No tags yet"
          description="Tags help you organize and find bookmarks quickly"
          actionLabel="Create Tag"
          onAction={handleCreateTag}
        />
      </div>
    );
  }

  return (
    <div className="tags-view">
      <div className="tags-header">
        <h2>Tags</h2>
        <div className="tags-controls">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          <select value={sortBy} onChange={handleSortChange}>
            <option value="count">By Count</option>
            <option value="name">By Name</option>
          </select>
          <Button
            variant="primary"
            onClick={handleCreateTag}
            icon="add"
          >
            New Tag
          </Button>
        </div>
      </div>

      <div className="tags-grid">
        {filteredTags.length > 0 ? (
          filteredTags.map(tag => (
            <TagItem
              key={tag.id}
              tag={tag}
              onSelect={handleSelectTag}
              onEdit={handleEditTag}
              onDelete={handleDeleteTag}
            />
          ))
        ) : (
          <EmptyState
            icon="search"
            title="No tags found"
            description="Try adjusting your search query"
          />
        )}
      </div>
    </div>
  );
});

TagsView.displayName = 'TagsView';
