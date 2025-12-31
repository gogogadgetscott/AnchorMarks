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
    const openTagRegex = new RegExp(`<${tagName}`, 'i');
    const closeTagRegex = new RegExp(`<\/${tagName}>`, 'i');

    while (depth > 0 && pos < str.length) {
      const remaining = str.substring(pos);
      const nextOpenMatch = remaining.match(openTagRegex);
      const nextCloseMatch = remaining.match(closeTagRegex);
      
      const nextOpen = nextOpenMatch ? pos + nextOpenMatch.index : -1;
      const nextClose = nextCloseMatch ? pos + nextCloseMatch.index : -1;

      if (nextClose === -1) return -1;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + tagName.length + 1; // <TAG
      } else {
        depth--;
        pos = nextClose + tagName.length + 3; // </TAG>
      }
      if (depth === 0) return nextClose;
    }
    return -1;
  }

  function parseBlock(blockHtml, currentParentId) {
    let i = 0;
    const len = blockHtml.length;

    while (i < len) {
      const nextTag = blockHtml.substring(i);
      
      const dtMatch = nextTag.match(/<DT>/i);
      if (!dtMatch) break;
      
      const dtIndex = i + dtMatch.index;
      i = dtIndex + 4;

      if (/^<H3/i.test(blockHtml.substring(i))) {
        const h3EndMatch = blockHtml.substring(i).match(/<\/H3>/i);
        if (!h3EndMatch) {
            i++; 
            continue;
        }
        const h3EndInfo = { index: h3EndMatch.index, length: h3EndMatch[0].length };
        
        const h3End = i + h3EndInfo.index;
        const h3Start = blockHtml.indexOf(">", i) + 1;
        const folderName = blockHtml.substring(h3Start, h3End);

        const dlMatch = blockHtml.substring(h3End).match(/<DL>/i);
        
        if (dlMatch) {
            const dlStart = h3End + dlMatch.index;
            const dlEnd = findClosingTag(blockHtml, dlStart, "DL");

            if (dlStart !== -1 && dlEnd !== -1) {
              const folderId = createFolder(folderName, currentParentId);
              const innerHtml = blockHtml.substring(dlStart + 4, dlEnd);
              parseBlock(innerHtml, folderId);
              i = dlEnd + 5;
            } else {
              i = h3End + h3EndInfo.length;
            }
        } else {
             i = h3End + h3EndInfo.length;
        }

      } else if (/^<A/i.test(blockHtml.substring(i))) {
        const aEndMatch = blockHtml.substring(i).match(/<\/A>/i);
        if (!aEndMatch) { i++; continue; }
        
        const aEnd = i + aEndMatch.index;
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
