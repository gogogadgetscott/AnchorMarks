const { v4: uuidv4 } = require("uuid");
const { parseTags, stringifyTags } = require("./tags");

async function parseBookmarkHtml(html) {
  const bookmarks = [];
  const folders = [];

  function createFolder(name, parentId) {
    const id = uuidv4();
    folders.push({
      id,
      name,
      parent_id: parentId,
      icon: "folder",
      color: "#6366f1",
    });
    return id;
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
          const colorMatch = attributes.match(/COLOR=["']([^"']+)["']/i);
          const color = colorMatch ? colorMatch[1] : null;

          if (!url.startsWith("javascript:") && !url.startsWith("place:")) {
            const tagsString = tags ? stringifyTags(parseTags(tags)) : null;

            bookmarks.push({
              title,
              url,
              folder_id: currentParentId,
              tags: tagsString,
              color,
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

  return { bookmarks, folders };
}

module.exports = { parseBookmarkHtml };
