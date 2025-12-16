const { v4: uuidv4 } = require("uuid");
const bookmarkModel = require("../models/bookmark");
const folderModel = require("../models/folder");
const { ensureTagsExist, updateBookmarkTags } = require("./tag-helpers");
const tagHelpers = require("./tags");
const { parseTags, stringifyTags } = tagHelpers;

async function parseBookmarkHtml(db, html, userId, fetchFaviconWrapper) {
  const imported = [];

  function createFolder(name, parentId) {
    return folderModel.ensureFolder(db, userId, name, parentId);
  }

  function findClosingTag(str, start, tagName) {
    let depth = 1;
    let pos = start + tagName.length + 2;
    const openTag = `<${tagName}`;
    const closeTag = `</${tagName}>`;

    while (depth > 0 && pos < str.length) {
      const nextOpen = str.indexOf(openTag, pos);
      const nextClose = str.indexOf(closeTag, pos);

      if (nextClose === -1) return -1;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTag.length;
      } else {
        depth--;
        pos = nextClose + closeTag.length;
      }
      if (depth === 0) return nextClose;
    }
    return -1;
  }

  function parseBlock(blockHtml, currentParentId) {
    let i = 0;
    const len = blockHtml.length;

    while (i < len) {
      const dtIndex = blockHtml.indexOf("<DT>", i);
      if (dtIndex === -1) break;

      i = dtIndex + 4;

      if (blockHtml.startsWith("<H3", i)) {
        const h3End = blockHtml.indexOf("</H3>", i);
        const h3Start = blockHtml.indexOf(">", i) + 1;
        const folderName = blockHtml.substring(h3Start, h3End);

        const dlStart = blockHtml.indexOf("<DL>", h3End);
        const dlEnd = findClosingTag(blockHtml, dlStart, "DL");

        if (dlStart !== -1 && dlEnd !== -1) {
          const folderId = createFolder(folderName, currentParentId);
          const innerHtml = blockHtml.substring(dlStart + 4, dlEnd);
          parseBlock(innerHtml, folderId);
          i = dlEnd + 5;
        } else {
          i = h3End + 5;
        }
      } else if (blockHtml.startsWith("<A", i)) {
        const aEnd = blockHtml.indexOf("</A>", i);
        const aTagEnd = blockHtml.indexOf(">", i);
        const title = blockHtml.substring(aTagEnd + 1, aEnd);
        const attributes = blockHtml.substring(i, aTagEnd);

        const hrefMatch = attributes.match(/HREF="([^"]+)"/i);
        if (hrefMatch) {
          const url = hrefMatch[1];
          const tagsMatch = attributes.match(/TAGS=["']([^"']+)["']/i);
          const tags = tagsMatch ? tagsMatch[1] : null;

          if (!url.startsWith("javascript:") && !url.startsWith("place:")) {
            const id = uuidv4();
            const faviconUrl = null;
            const tagsString = tags ? stringifyTags(parseTags(tags)) : null;

            const created = bookmarkModel.createBookmark(db, {
              id,
              user_id: userId,
              folder_id: currentParentId,
              title,
              url,
              favicon: faviconUrl,
            });

            if (tagsString) {
              const tagIds = ensureTagsExist(db, userId, tagsString);
              updateBookmarkTags(db, created.id, tagIds);
            }

            if (fetchFaviconWrapper)
              fetchFaviconWrapper(url, created.id).catch(console.error);
            imported.push({
              id: created.id,
              title,
              url,
              tags: tagsString || null,
            });
          }
        }
        i = aEnd + 4;
      } else {
        i++;
      }
    }
  }

  parseBlock(html, null);

  return imported;
}

module.exports = { parseBookmarkHtml };
