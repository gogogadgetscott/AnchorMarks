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

  // Helper to strip tags
  const stripTags = (str) => str.replace(/<[^>]*>/g, "");

  function parseFragment(fragment, parentId) {
    // Current position in the fragment
    let pos = 0;
    
    // Regex for finding relevant tags
    // We look for <DT> (optional), then either <H3> (folder) or <A> (bookmark)
    // This regex matches the *start* of interesting blocks
    const tagRegex = /<(H3|A|DL)(?:\s+[^>]*)?>/gi;
    
    let match;
    while ((match = tagRegex.exec(fragment)) !== null) {
      if (match.index < pos) continue; // Skip if we've already parsed past this match
      
      const tagName = match[1].toUpperCase();
      const tagStart = match.index;
      const tagContentStart = match.index + match[0].length;
      
      if (tagName === 'H3') {
         // FOLDER FOUND
         const endTagRegex = /<\/H3>/gi;
         endTagRegex.lastIndex = tagContentStart;
         const endMatch = endTagRegex.exec(fragment);
         
         if (endMatch) {
           const folderName = stripTags(fragment.substring(tagContentStart, endMatch.index)).trim();
           const folderId = createFolder(folderName, parentId);
           
           // Look for the associated DL (list of items)
           // It usually follows the H3 immediately or after some whitespace/DTs
           const remaining = fragment.substring(endMatch.index + endMatch[0].length);
           const nextDlMatch = remaining.match(/<DL[^>]*>/i);
           
           if (nextDlMatch) {
             // Find matching </DL>
             const dlStartAbs = endMatch.index + endMatch[0].length + nextDlMatch.index;
             const dlContentStart = dlStartAbs + nextDlMatch[0].length;
             
             // Simple recursive balancer for DL
             let depth = 1;
             let currentRegex = /<\/?DL[^>]*>/gi;
             currentRegex.lastIndex = dlContentStart;
             let subMatch;
             let dlEndAbs = -1;
             
             while ((subMatch = currentRegex.exec(fragment)) !== null) {
               if (subMatch[0].toUpperCase().startsWith("</DL")) {
                 depth--;
               } else {
                 depth++;
               }
               if (depth === 0) {
                 dlEndAbs = subMatch.index;
                 break;
               }
             }
             
             if (dlEndAbs !== -1) {
               // Recursively parse the content of the DL
               parseFragment(fragment.substring(dlContentStart, dlEndAbs), folderId);
               
               // Advance main loop past this folder block
               // We set lastIndex to continue AFTER the </DL>
               tagRegex.lastIndex = dlEndAbs + 5; // length of </DL>
               pos = dlEndAbs + 5;
             }
           }
           // If no DL follows, it is an empty folder or malformed, just continue
         }
         
      } else if (tagName === 'A') {
        // BOOKMARK FOUND
        const endTagRegex = /<\/A>/gi;
        endTagRegex.lastIndex = tagContentStart;
        const endMatch = endTagRegex.exec(fragment);
        
        if (endMatch) {
           const title = stripTags(fragment.substring(tagContentStart, endMatch.index)).trim();
           const fullTag = fragment.substring(tagStart, endMatch.index + 4); // <A ... > ... </A>
           
           // Extract Attributes
           const hrefMatch = fullTag.match(/HREF=["']([^"']+)["']/i);
           if (hrefMatch) {
             const url = hrefMatch[1];
             
             // Extract other props
             const tagsMatch = fullTag.match(/TAGS=["']([^"']+)["']/i);
             const tags = tagsMatch ? tagsMatch[1] : null;
             const colorMatch = fullTag.match(/COLOR=["']([^"']+)["']/i);
             const color = colorMatch ? colorMatch[1] : null;
             
             if (!url.startsWith("javascript:") && !url.startsWith("place:")) {
               const tagsString = tags ? stringifyTags(parseTags(tags)) : null;
               
               bookmarks.push({
                 title: title || url,
                 url,
                 folder_id: parentId,
                 tags: tagsString,
                 color
               });
             }
           }
           
           // Advance pos
           pos = endMatch.index + 4;
        }
      }
      // Note: We ignore DL tags encountered at the top level of this fragment loop 
      // because they are handled recursively after H3s. 
      // If a DL appears on its own without H3, it's just a container we should technically enter, 
      // but standard export format associates DLs with H3s.
      // However, the ROOT DL (if any) is stripped by calling parseFragment on the whole string.
      
      // Safety: ensure we always advance the regex if we manually moved pos 
      if (tagRegex.lastIndex < pos) {
          tagRegex.lastIndex = pos;
      }
    }
  }

  // Pre-process: sometimes the file starts with <!DOCTYPE> or <META>, remove them to be clean
  // Also, find the first DL to start parsing, as that contains the root items
  const rootDlMatch = html.match(/<DL[^>]*>/i);
  if (rootDlMatch) {
    const rootStart = rootDlMatch.index + rootDlMatch[0].length;
    const lastDlEnd = html.lastIndexOf("</DL>"); // Rough approximation for root end
    // Ideally we parse validly, but for root we can just assume everything inside the first DL is content
    if (lastDlEnd > rootStart) {
        parseFragment(html.substring(rootStart, lastDlEnd), null);
    } else {
        // Fallback: just parse the whole thing if structure is weird
        parseFragment(html, null);
    }
  } else {
    parseFragment(html, null);
  }

  return { bookmarks, folders };
}

module.exports = { parseBookmarkHtml };
