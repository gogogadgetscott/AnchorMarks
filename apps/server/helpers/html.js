// Lightweight HTML metadata parsing utilities
function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&nbsp;": " ",
  };
  return (text || "").replace(
    /&[a-z0-9#]+;/gi,
    (match) => entities[match] || match,
  );
}

function parseHtmlMetadata(html, url) {
  const metadata = {
    title: "",
    description: "",
    og_image: "",
    url: url,
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  const descMatch =
    html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) {
    metadata.description = decodeHtmlEntities(descMatch[1].trim());
  }

  const ogTitleMatch =
    html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  const ogDescMatch =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i,
    );
  if (ogDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(ogDescMatch[1].trim());
  }

  const twitterTitleMatch =
    html.match(
      /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i,
    );
  if (twitterTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(twitterTitleMatch[1].trim());
  }

  const twitterDescMatch =
    html.match(
      /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:description["']/i,
    );
  if (twitterDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(twitterDescMatch[1].trim());
  }

  const ogImageMatch =
    html.match(
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (ogImageMatch) {
    metadata.og_image = decodeHtmlEntities(ogImageMatch[1].trim());
  }

  const twitterImageMatch =
    html.match(
      /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
    );
  if (twitterImageMatch && !metadata.og_image) {
    metadata.og_image = decodeHtmlEntities(twitterImageMatch[1].trim());
  }

  if (!metadata.title) {
    try {
      metadata.title = new URL(url).hostname;
    } catch {
      metadata.title = url;
    }
  }

  return metadata;
}

function generateBookmarkHtml(bookmarks, folders) {
  // Create logical tree structure
  const folderMap = {};
  const rootItems = [];

  // Initialize folder map
  folders.forEach((f) => {
    folderMap[f.id] = {
      ...f,
      childrenFolders: [],
      childrenBookmarks: [],
    };
  });

  // Organize folders into hierarchy
  folders.forEach((f) => {
    if (f.parent_id && folderMap[f.parent_id]) {
      folderMap[f.parent_id].childrenFolders.push(folderMap[f.id]);
    } else {
      // Root level folder (or orphaned if parent missing, treating as root)
      if (!f.parent_id)
        rootItems.push({ type: "folder", data: folderMap[f.id] });
    }
  });

  // Add bookmarks to their folders
  bookmarks.forEach((b) => {
    if (b.folder_id && folderMap[b.folder_id]) {
      folderMap[b.folder_id].childrenBookmarks.push(b);
    } else {
      // Root level bookmark
      rootItems.push({ type: "bookmark", data: b });
    }
  });

  // Sort items to ensure consistent output (optional but good)
  // Folders usually come first or mixed. We'll mix them but sort by some criteria if needed.
  // For now, we respect the API sort order but folders usually group together.
  // Let's just process folders then bookmarks within each level or just append logical order.

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <!--This is an automatically generated file.
    It will be read and overwritten.
    Do Not Edit! -->
    <Title>Bookmarks</Title>
    <H1>Bookmarks</H1>
    <DL><p>
`;

  function generateLevel(items, indent = "    ") {
    let output = "";

    // Process items. If items is mixed (roots), we iterate.
    // If we are inside a folder, we need to process its childrenFolders and childrenBookmarks

    // Sort logic: Folders first, then bookmarks, or by position if available.
    // Assuming 'items' passed here is a mixed list for root,
    // but for folders we have separate arrays.

    // Helper to render a bookmark
    const renderBookmark = (bm) => {
      const tagsAttr = bm.tags ? ` TAGS="${bm.tags}"` : "";
      const dateAttr = bm.created_at
        ? ` ADD_DATE="${Math.floor(new Date(bm.created_at).getTime() / 1000)}"`
        : "";

      let extraAttrs = "";
      if (bm.updated_at) {
        extraAttrs += ` LAST_MODIFIED="${Math.floor(new Date(bm.updated_at).getTime() / 1000)}"`;
      }
      if (bm.last_clicked) {
        extraAttrs += ` LAST_VISIT="${Math.floor(new Date(bm.last_clicked).getTime() / 1000)}"`;
      }

      // Debug logging for color
      if (bm.id === "0aee44e1-9883-4046-bc47-a66e6f5912ec") {
        console.log(
          `[Export] Processing target bookmark ${bm.id}. Color: ${bm.color}`,
        );
      }

      if (bm.color) {
        extraAttrs += ` COLOR="${bm.color}"`;
      }

      return `${indent}<DT><A HREF="${bm.url}"${tagsAttr}${dateAttr}${extraAttrs}>${bm.title}</A>\n`;
    };

    // Helper to render a folder
    const renderFolder = (folder) => {
      const dateAttr = folder.created_at
        ? ` ADD_DATE="${Math.floor(new Date(folder.created_at).getTime() / 1000)}"`
        : "";
      let headerAttrs = dateAttr;
      if (folder.updated_at) {
        headerAttrs += ` LAST_MODIFIED="${Math.floor(new Date(folder.updated_at).getTime() / 1000)}"`;
      }
      if (folder.color) {
        headerAttrs += ` COLOR="${folder.color}"`;
      }

      let chunk = `${indent}<DT><H3${headerAttrs}>${folder.name}</H3>\n`;
      chunk += `${indent}<DL><p>\n`;

      // Recursively render children
      if (folder.childrenFolders.length > 0) {
        folder.childrenFolders.forEach((sub) => {
          chunk += renderFolder(sub);
        });
      }
      if (folder.childrenBookmarks.length > 0) {
        folder.childrenBookmarks.forEach((bm) => {
          chunk += renderBookmark(bm);
        });
      }

      chunk += `${indent}</DL><p>\n`;
      return chunk;
    };

    items.forEach((item) => {
      if (item.type === "folder") {
        output += renderFolder(item.data);
      } else {
        output += renderBookmark(item.data);
      }
    });

    return output;
  }

  // Generate valid root list
  // Note: rootItems contains {type, data} wrappers.

  // Sort root items: folders first?
  rootItems.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "folder" ? -1 : 1;
  });

  html += generateLevel(rootItems);
  html += `</DL><p>`;

  return html;
}

module.exports = {
  parseHtmlMetadata,
  decodeHtmlEntities,
  generateBookmarkHtml,
};
