const { v4: uuidv4 } = require("uuid");
const cheerio = require("cheerio");
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

  const $ = cheerio.load(html);

  function processList(dlElement, parentId) {
    // Netscape format: <DL> contains <DT> items which contain either <H3> (folder) or <A> (link)
    // <H3> is followed by another <DL> for the folder contents
    
    // We iterate over all children to handle malformed HTML where DT might be missing
    const children = $(dlElement).children();
    
    children.each((_, el) => {
      const element = $(el);
      const tagName = element.prop("tagName");

      // Handle <DT> wrapper (standard format)
      if (tagName === "DT") {
        processItem(element, parentId);
      } 
      // Handle direct <A> or <H3> (loose format)
      else if (tagName === "A" || tagName === "H3") {
         // If it's a direct child, we process it directly. 
         // Note: processItem expects the container (DT) or the item itself if checking children.
         // Let's make a specific handler for the node type.
         if (tagName === "A") processBookmark(element, parentId);
         if (tagName === "H3") processFolder(element, parentId);
      }
    });
  }

  function processItem(dtElement, parentId) {
    // Check for Folder Header <H3>
    const h3 = dtElement.children("h3").first();
    if (h3.length > 0) {
      processFolder(h3, parentId);
      return;
    }

    // Check for Bookmark Link <A>
    const a = dtElement.children("a").first();
    if (a.length > 0) {
      processBookmark(a, parentId);
    }
  }

  function processFolder(h3Element, parentId) {
    const folderName = h3Element.text().trim();
    const folderId = createFolder(folderName, parentId);

    // The folder contents <DL> usually follows the <H3>
    // In standard structure: <DT><H3>...</H3><DL>...</DL></DT>
    // So we look for a sibling DL of the H3, or a child DL of the parent DT
    
    let dl = h3Element.next("dl");
    
    // Sometimes it's nested differently or H3 matches the DT parent's next sibling
    if (dl.length === 0) {
        // Try next sibling of parent DT
        dl = h3Element.parent("dt").next("dd").children("dl");
    }
    // Try standard netscape: DT -> H3, DL (DL is sibling of H3 inside DT? No, usually DT contains H3, and DL follows DT... or DL is inside DD?)
    // Actually standard is: <DT><H3>...</H3><DL>...</DL></DT> (some browsers)
    // Or: <DT><H3>...</H3></DT><DD><DL>...</DL></DD> (IE style)
    
    if (dl.length === 0) {
        // Look for DL as sibling of H3
         dl = h3Element.siblings("dl");
    }
    
    if (dl.length === 0) {
        // Look for DL as immediate sibling of parent DT (some formats)
        dl = h3Element.parent().next("dl");
    }
    
    if (dl.length === 0) {
        // Look for DL in the next DD (definition description)
        dl = h3Element.parent().next("dd").children("dl");
    }

    if (dl.length > 0) {
      processList(dl, folderId);
    }
  }

  function processBookmark(aElement, parentId) {
    const url = aElement.attr("href");
    const title = aElement.text().trim() || url;
    
    if (!url || url.startsWith("javascript:") || url.startsWith("place:")) {
      return;
    }

    // Extract attributes
    const tagsAttr = aElement.attr("tags");
    const colorAttr = aElement.attr("color");
    
    const tagsString = tagsAttr ? stringifyTags(parseTags(tagsAttr)) : null;

    bookmarks.push({
      title,
      url,
      folder_id: parentId,
      tags: tagsString,
      color: colorAttr
    });
  }

  // Start parsing from the root DL
  // Many exports capture data in the first DL found
  const rootDl = $("dl").first();
  if (rootDl.length > 0) {
    processList(rootDl, null);
  }

  return { bookmarks, folders };
}

module.exports = { parseBookmarkHtml };
