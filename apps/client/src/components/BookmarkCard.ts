import { Icon } from "./Icon.ts";
import { Tag } from "./Tag.ts";
import { Button } from "./Button.ts";
import { escapeHtml, getHostname, getBaseUrl } from "@utils/index.ts";
import * as state from "@features/state.ts";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  tags?: string;
  tags_detailed?: Array<{
    name: string;
    color?: string;
    color_override?: string;
  }>;
  folder_id?: string;
  color?: string;
  [key: string]: any;
}

/**
 * Component for rendering a bookmark card.
 * @param {Bookmark} bookmark - The bookmark data.
 * @param {number} index - The index in the current list.
 * @returns {string} - HTML string of the bookmark card.
 */
export function BookmarkCard(bookmark: Bookmark, index: number): string {
  const tagsFromString = bookmark.tags
    ? bookmark.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t)
    : [];

  const tagEntries = Array.isArray(bookmark.tags_detailed)
    ? bookmark.tags_detailed.map((t) => ({
        name: t.name,
        color: t.color,
        color_override: t.color_override,
      }))
    : tagsFromString.map((name) => ({
        name,
        color: undefined,
        color_override: undefined,
      }));

  const hostname = getHostname(bookmark.url);
  const baseUrl = getBaseUrl(bookmark.url);
  const displayUrl = state.viewMode === "list" ? baseUrl : hostname;
  const isSelected = state.selectedBookmarks.has(bookmark.id);

  const tagsHtml = tagEntries.length
    ? `<div class="bookmark-tags">${tagEntries
        .map((tag) => {
          const tagName = tag.name;
          const tagMeta = state.tagMetadata[tagName] || {};
          const tagColor =
            tag.color_override || tag.color || tagMeta.color || "#f59e0b";
          return Tag(tagName, {
            color: tagColor,
            data: { action: "toggle-filter-tag", tag: tagName },
          });
        })
        .join("")}</div>`
    : "";

  const faviconHtml =
    !state.hideFavicons && bookmark.favicon
      ? `<img src="${bookmark.favicon}" alt="" class="bookmark-favicon-img" data-fallback="true" loading="lazy">`
      : Icon("link", { size: 24 });

  // Apply custom bookmark background color if set
  // Use inline style for direct color application + CSS custom property for theming
  const colorStyle = bookmark.color
    ? `--bookmark-color: ${bookmark.color}; background-color: ${bookmark.color};`
    : "";
  const hasColorClass = bookmark.color ? "has-custom-color" : "";

  const delayClass = `delay-${index % 10}`;

  return `
    <div class="bookmark-card ${isSelected ? "selected" : ""} ${hasColorClass} entrance-animation ${delayClass}"
      data-id="${bookmark.id}"
      data-index="${index}"
      style="${colorStyle}"
      role="listitem"
      tabindex="0"
      aria-label="${escapeHtml(bookmark.title)}"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.querySelector('[data-action=\'open-bookmark\']')?.click();}"
    >
      <label class="bookmark-select">
        <input type="checkbox" ${isSelected ? "checked" : ""}>
      </label>
      <div class="bookmark-header">
        <div class="bookmark-favicon">
          ${faviconHtml}
        </div>
        <div class="bookmark-info">
          <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
          <div class="bookmark-url" data-full-url="${escapeHtml(bookmark.url)}">${escapeHtml(displayUrl)}</div>
        </div>
      </div>
      ${bookmark.description ? `<div class="bookmark-description">${escapeHtml(bookmark.description)}</div>` : ""}
      ${tagsHtml}
      <div class="bookmark-actions">
        ${Button("Open", {
          variant: "primary",
          className: "bookmark-action-btn",
          icon: "external",
          data: { action: "open-bookmark", url: bookmark.url },
          title: "Open bookmark",
        })}
        ${Button("Edit", {
          variant: "secondary",
          className: "bookmark-action-btn",
          icon: "edit",
          data: { action: "edit-bookmark", id: bookmark.id },
          title: "Edit bookmark",
        })}
        ${Button("", {
          variant: bookmark.is_favorite ? "warning" : "ghost",
          className: "bookmark-action-btn",
          icon: bookmark.is_favorite ? "star-filled" : "star",
          data: { action: "toggle-favorite", id: bookmark.id },
          title: bookmark.is_favorite
            ? "Remove from favorites"
            : "Add to favorites",
        })}
        ${Button("", {
          variant: "ghost",
          className: "bookmark-action-btn",
          icon: "copy",
          data: { action: "copy-link", url: bookmark.url },
          title: "Copy link",
        })}
        ${
          bookmark.is_archived
            ? Button("", {
                variant: "ghost",
                className: "bookmark-action-btn",
                icon: "unarchive",
                data: { action: "unarchive-bookmark", id: bookmark.id },
                title: "Unarchive bookmark",
              })
            : Button("", {
                variant: "ghost",
                className: "bookmark-action-btn",
                icon: "archive",
                data: { action: "archive-bookmark", id: bookmark.id },
                title: "Archive bookmark",
              })
        }
        ${Button("", {
          variant: "danger",
          className: "bookmark-action-btn",
          icon: "trash",
          data: { action: "delete-bookmark", id: bookmark.id },
          title: "Delete bookmark",
        })}
      </div>
    </div>
  `;
}
