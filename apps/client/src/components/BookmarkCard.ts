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
  tags_detailed?: Array<{ name: string; color?: string; color_override?: string }>;
  folder_id?: string;
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
    : tagsFromString.map((name) => ({ name, color: undefined, color_override: undefined }));

  const hostname = getHostname(bookmark.url);
  const baseUrl = getBaseUrl(bookmark.url);
  const displayUrl = state.viewMode === "list" ? baseUrl : hostname;
  const isSelected = state.selectedBookmarks.has(bookmark.id);

  const tagsHtml = tagEntries.length
    ? `<div class="bookmark-tags">${tagEntries
      .map((tag) => {
        const tagName = tag.name;
        const tagMeta = state.tagMetadata[tagName] || {};
        const tagColor = tag.color_override || tag.color || tagMeta.color || "#f59e0b";
        return Tag(tagName, {
          color: tagColor,
          data: { action: "toggle-filter-tag", tag: tagName }
        });
      })
      .join("")}</div>`
    : "";

  const faviconHtml = !state.hideFavicons && bookmark.favicon
    ? `<img src="${bookmark.favicon}" alt="" class="bookmark-favicon-img" data-fallback="true">`
    : Icon("link", { size: 24 });

  return `
    <div class="bookmark-card ${isSelected ? "selected" : ""}" data-id="${bookmark.id}" data-index="${index}">
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
    title: "Open bookmark"
  })}
        ${Button("Edit", {
    variant: "secondary",
    className: "bookmark-action-btn",
    icon: "edit",
    data: { action: "edit-bookmark", id: bookmark.id },
    title: "Edit bookmark"
  })}
        ${Button("", {
    variant: "ghost",
    className: "bookmark-action-btn",
    icon: "copy",
    data: { action: "copy-link", url: bookmark.url },
    title: "Copy link"
  })}
        ${Button("", {
    variant: "danger",
    className: "bookmark-action-btn",
    icon: "trash",
    data: { action: "delete-bookmark", id: bookmark.id },
    title: "Delete bookmark"
  })}
      </div>
    </div>
  `;
}
