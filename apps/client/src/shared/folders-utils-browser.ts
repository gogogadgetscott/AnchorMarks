import { buildFolderOptionsHTML } from "@features/bookmarks/folders-utils";

// Expose functions on window under a namespaced global for legacy static pages
// (e.g., /addbookmark)
declare global {
  interface Window {
    anchorMarks?: { buildFolderOptionsHTML?: typeof buildFolderOptionsHTML };
  }
}

// Ensure a small, stable namespace to avoid polluting global scope
window.anchorMarks = window.anchorMarks || {};
window.anchorMarks.buildFolderOptionsHTML = buildFolderOptionsHTML;
export {};
