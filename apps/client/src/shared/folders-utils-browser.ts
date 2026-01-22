import { buildFolderOptionsHTML } from "@features/bookmarks/folders-utils";

// Expose functions on window for legacy static pages that load a runtime script
// (e.g., /addbookmark)
declare global {
  interface Window {
    buildFolderOptionsHTML?: typeof buildFolderOptionsHTML;
  }
}

window.buildFolderOptionsHTML = buildFolderOptionsHTML;
export {};
