import { Icon } from "./Icon.ts";
import { Tag } from "./Tag.ts";
import { Button } from "./Button.ts";
import { escapeHtml, getHostname } from "@utils/index.ts";
import * as state from "@features/state.ts";

interface Bookmark {
    id: string;
    title: string;
    url: string;
    description?: string;
    favicon?: string;
    og_image?: string;
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
 * Component for rendering a rich bookmark card with an OG image.
 * @param {Bookmark} bookmark - The bookmark data.
 * @param {number} index - The index in the current list.
 * @returns {string} - HTML string of the rich bookmark card.
 */
export function RichBookmarkCard(bookmark: Bookmark, index: number): string {
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
            : Icon("link", { size: 16 });

    const delayClass = `delay-${index % 10}`;

    const imageHtml = bookmark.og_image
        ? `<div class="rich-card-image">
         <img src="${bookmark.og_image}" alt="" loading="lazy">
       </div>`
        : `<div class="rich-card-image-placeholder">
         ${Icon("image", { size: 48 })}
       </div>`;

    return `
    <div class="rich-bookmark-card ${isSelected ? "selected" : ""} entrance-animation ${delayClass}" data-id="${bookmark.id}" data-index="${index}">
      <label class="bookmark-select">
        <input type="checkbox" ${isSelected ? "checked" : ""}>
      </label>
      ${imageHtml}
      <div class="rich-card-content">
        <div class="rich-card-header">
          <div class="bookmark-favicon">${faviconHtml}</div>
          <div class="bookmark-url">${escapeHtml(hostname)}</div>
        </div>
        <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
        ${bookmark.description ? `<div class="bookmark-description">${escapeHtml(bookmark.description)}</div>` : ""}
        ${tagsHtml}
      </div>
      <div class="bookmark-actions">
        ${Button("", {
        variant: "ghost",
        className: "bookmark-action-btn",
        icon: "external",
        data: { action: "open-bookmark", url: bookmark.url },
        title: "Open bookmark",
    })}
        ${Button("", {
        variant: "ghost",
        className: "bookmark-action-btn",
        icon: "edit",
        data: { action: "edit-bookmark", id: bookmark.id },
        title: "Edit bookmark",
    })}
        ${Button("", {
        variant: "ghost",
        className: "bookmark-action-btn",
        icon: "trash",
        data: { action: "delete-bookmark", id: bookmark.id },
        title: "Delete bookmark",
    })}
      </div>
    </div>
  `;
}
