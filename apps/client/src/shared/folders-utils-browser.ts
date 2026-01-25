import { buildFolderOptionsHTML } from "@features/bookmarks/folders-utils";

// Expose functions on window under a namespaced global for legacy static pages
// (e.g., /addbookmark)
declare global {
  interface Window {
    anchormarks?: { buildFolderOptionsHTML?: typeof buildFolderOptionsHTML };
  }
}

// Ensure a small, stable namespace (lowercase) to avoid polluting global scope
window.anchormarks = window.anchormarks || {};
window.anchormarks.buildFolderOptionsHTML = buildFolderOptionsHTML;
export {};
