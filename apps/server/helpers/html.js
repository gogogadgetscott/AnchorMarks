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
  return (text || "").replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match);
}

function parseHtmlMetadata(html, url) {
  const metadata = {
    title: "",
    description: "",
    url: url,
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  const descMatch =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) {
    metadata.description = decodeHtmlEntities(descMatch[1].trim());
  }

  const ogTitleMatch =
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  const ogDescMatch =
    html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
  if (ogDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(ogDescMatch[1].trim());
  }

  const twitterTitleMatch =
    html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i);
  if (twitterTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(twitterTitleMatch[1].trim());
  }

  const twitterDescMatch =
    html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']twitter:description["']/i);
  if (twitterDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(twitterDescMatch[1].trim());
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
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>AnchorMarks Bookmarks</TITLE>\n<H1>AnchorMarks Bookmarks</H1>\n<DL><p>\n`;

  for (const bm of bookmarks) {
    const tagsAttr = bm.tags ? ` TAGS="${bm.tags}"` : "";
    html += `    <DT><A HREF="${bm.url}"${tagsAttr}>${bm.title}</A>\n`;
  }

  html += `</DL><p>`;
  return html;
}

module.exports = { parseHtmlMetadata, decodeHtmlEntities, generateBookmarkHtml };
