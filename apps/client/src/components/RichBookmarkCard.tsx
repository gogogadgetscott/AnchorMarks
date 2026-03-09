import { useState } from "react";
import { Icon } from "./Icon.tsx";
import { Tag } from "./Tag.tsx";
import { Button } from "./Button.tsx";
import { getHostname } from "@utils/index.ts";
import { useUI } from "@/contexts/index.ts";
import { useBookmarks } from "@/contexts/index.ts";
import type { Bookmark } from "../types/index";

interface RichBookmarkCardProps {
  bookmark: Bookmark;
  index: number;
  onOpen: () => void;
  onEdit: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onTagClick: (tagName: string) => void;
  onSelect: (index: number, shiftKey: boolean) => void;
}

function FaviconImage({ src, size }: { src: string; size: number }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <Icon name="link" size={size} />;
  }

  return (
    <span className="bookmark-favicon-wrap">
      <img
        src={src}
        alt=""
        className="bookmark-favicon-img img-loading"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    </span>
  );
}

export function RichBookmarkCard({
  bookmark,
  index,
  onOpen,
  onEdit,
  onFavorite,
  onCopy,
  onArchive,
  onDelete,
  onTagClick,
  onSelect,
}: RichBookmarkCardProps) {
  const { hideFavicons } = useUI();
  const { tagMetadata, selectedBookmarks } = useBookmarks();

  const isSelected = selectedBookmarks.has(bookmark.id);

  const tagsFromString = bookmark.tags
    ? bookmark.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const tagEntries = Array.isArray(bookmark.tags_detailed)
    ? bookmark.tags_detailed
    : tagsFromString.map((name) => ({
        name,
        color: undefined,
        color_override: undefined,
      }));

  const hostname = getHostname(bookmark.url);

  const shouldUseFavicon =
    !hideFavicons &&
    !!bookmark.favicon &&
    bookmark.favicon.startsWith("/favicons/");

  const favicon = shouldUseFavicon ? (
    <FaviconImage src={bookmark.favicon!} size={16} />
  ) : (
    <Icon name="link" size={16} />
  );

  const favoriteIndicator = bookmark.is_favorite ? (
    <span className="bookmark-favorite-indicator" aria-hidden="true">
      <Icon name="star-filled" size={12} />
    </span>
  ) : null;

  const tagsEl = tagEntries.length ? (
    <div className="bookmark-tags">
      {tagEntries.map((tag) => {
        const meta = tagMetadata[tag.name] ?? {};
        const color =
          (tag as { color_override?: string }).color_override ??
          tag.color ??
          meta.color ??
          "#f59e0b";
        return (
          <Tag
            key={tag.name}
            name={tag.name}
            color={color}
            onClick={() => onTagClick(tag.name)}
          />
        );
      })}
    </div>
  ) : null;

  const imageSrc = bookmark.og_image ?? bookmark.thumbnail_local;
  const imageEl = imageSrc ? (
    <div className="rich-card-image">
      <img src={imageSrc} alt="" className="img-loading" loading="lazy" />
    </div>
  ) : (
    <div
      className="rich-card-image-placeholder"
      data-bookmark-id={bookmark.id}
      data-bookmark-url={bookmark.url}
    >
      <Icon name="image" size={48} />
    </div>
  );

  const colorStyle = bookmark.color
    ? ({
        "--bookmark-color": bookmark.color,
        backgroundColor: bookmark.color,
      } as React.CSSProperties)
    : undefined;

  const delayClass = `delay-${index % 10}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('label.bookmark-select') ||
      target.closest('.bookmark-actions')
    ) {
      return;
    }
    onOpen();
  };

  return (
    <div
      className={`rich-bookmark-card ${isSelected ? "selected" : ""} ${bookmark.color ? "has-custom-color" : ""} entrance-animation ${delayClass}`}
      data-id={bookmark.id}
      data-index={index}
      style={colorStyle}
      onClick={handleCardClick}
    >
      <label className="bookmark-select">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) =>
            onSelect(
              index,
              e.nativeEvent instanceof MouseEvent &&
                (e.nativeEvent as MouseEvent).shiftKey,
            )
          }
        />
      </label>

      {imageEl}

      <div className="rich-card-content">
        <div className="rich-card-header">
          <div className="bookmark-favicon">{favicon}</div>
          <div className="bookmark-url">{hostname}</div>
        </div>
        <div className="bookmark-title">
          {favoriteIndicator}
          {bookmark.title}
        </div>
        {bookmark.description && (
          <div className="bookmark-description">{bookmark.description}</div>
        )}
        {tagsEl}
        <div className="bookmark-actions">
          <Button
            text="Edit"
            variant="secondary"
            className="bookmark-action-btn"
            icon="edit"
            title="Edit bookmark"
            onClick={onEdit}
          />
          <Button
            variant={bookmark.is_favorite ? "warning" : "ghost"}
            className="bookmark-action-btn"
            icon={bookmark.is_favorite ? "star-filled" : "star"}
            title={
              bookmark.is_favorite
                ? "Remove from favorites"
                : "Add to favorites"
            }
            onClick={onFavorite}
          />
          <Button
            variant="ghost"
            className="bookmark-action-btn"
            icon="copy"
            title="Copy link"
            onClick={onCopy}
          />
          {bookmark.is_archived ? (
            <Button
              variant="ghost"
              className="bookmark-action-btn"
              icon="unarchive"
              title="Unarchive bookmark"
              onClick={onArchive}
            />
          ) : (
            <Button
              variant="ghost"
              className="bookmark-action-btn"
              icon="archive"
              title="Archive bookmark"
              onClick={onArchive}
            />
          )}
          <Button
            variant="danger"
            className="bookmark-action-btn"
            icon="trash"
            title="Delete bookmark"
            onClick={onDelete}
          />
          <Button
            text="Open"
            variant="primary"
            className="bookmark-action-btn"
            icon="external"
            title="Open bookmark"
            onClick={onOpen}
          />
          
        </div>
      </div>
    </div>
  );
}
