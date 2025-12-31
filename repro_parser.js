const cheerio = require("cheerio");
const { v4: uuidv4 } = require("uuid");

const tags = {
  parseTags: (str) => (str ? str.split(",").map(s => s.trim()) : []),
  stringifyTags: (arr) => (arr ? arr.join(",") : "")
};

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
    const children = $(dlElement).children();
    
    children.each((_, el) => {
      const element = $(el);
      const tagName = element.prop("tagName");

      if (tagName === "DT") {
        processItem(element, parentId);
      } 
      else if (tagName === "A") {
         processBookmark(element, parentId);
      }
      else if (tagName === "H3") {
         processFolder(element, parentId);
      }
    });
  }

  function processItem(dtElement, parentId) {
    const h3 = dtElement.children("h3").first();
    if (h3.length > 0) {
      processFolder(h3, parentId);
      return;
    }

    const a = dtElement.children("a").first();
    if (a.length > 0) {
      processBookmark(a, parentId);
    }
  }

  function processFolder(h3Element, parentId) {
    const folderName = h3Element.text().trim();
    const folderId = createFolder(folderName, parentId);

    console.log(`Processing folder: ${folderName}`);
    
    let dl = h3Element.next("dl");
    
    if (dl.length === 0) {
        dl = h3Element.parent("dt").next("dd").children("dl");
    }
    
    if (dl.length === 0) {
         dl = h3Element.siblings("dl");
    }
    
    if (dl.length === 0) {
        dl = h3Element.parent().next("dd").children("dl");
    }

    if (dl.length === 0) {
         dl = h3Element.parent().next("dl");
    }
    
    if (dl.length > 0) {
      processList(dl, folderId);
    } else {
        // Fallback: Try looking for the next DL in siblings even if not immediate
        const nextDL = h3Element.nextAll("dl").first();
        const nextH3 = h3Element.nextAll("h3").first();
        
        if (nextDL.length > 0) {
             if (nextH3.length === 0 || nextDL.index() < nextH3.index()) {
                 console.log("  Found detached sibling DL");
                 processList(nextDL, folderId);
             }
        } else {
             console.log("  WARNING: No content DL found for folder " + folderName);
        }
    }
  }

  function processBookmark(aElement, parentId) {
    const url = aElement.attr("href");
    const title = aElement.text().trim() || url;
    
    if (!url || url.startsWith("javascript:") || url.startsWith("place:")) {
      return;
    }
    bookmarks.push({ title, url, folder_id: parentId });
  }

  const rootDl = $("dl").first();
  console.log(`Root DL found? ${rootDl.length > 0}`);
  if (rootDl.length > 0) {
    processList(rootDl, null);
  }

  return { bookmarks, folders };
}

const sampleHtmlAnchorMarksExport = `
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>My Folder</H3>
    <DL><p>
        <DT><A HREF="https://mysite.com">My Site</A>
    </DL><p>
</DL><p>
`;

(async () => {
    console.log("\n--- Testing AnchorMarks Export ---");
    const r6 = await parseBookmarkHtml(sampleHtmlAnchorMarksExport);
    console.log(`Imported: ${r6.bookmarks.length} bookmarks, ${r6.folders.length} folders`);
})();
