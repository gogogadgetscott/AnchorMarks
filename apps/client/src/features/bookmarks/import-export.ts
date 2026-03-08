/**
 * AnchorMarks - Import/Export Module
 * Handles bookmark import and export functionality
 */

import { api } from "@services/api.ts";
import { downloadBlob } from "@utils/index.ts";
import { showConfirm } from "@/contexts/ConfirmContext";
import {
  getBookmarksBridge,
  getFoldersBridge,
  getAuthBridge,
  getUIBridge,
  API_BASE,
} from "@/contexts/context-bridge";

/**
 * Import HTML bookmarks file
 */
export async function importHtml(
  file: File,
): Promise<{ imported: number; skipped: number; hasLog: boolean }> {
  const html = await file.text();
  const result = await api<{
    imported: number;
    skipped: number;
    import_log?: Array<{ status: string; url: string; reason?: string }>;
  }>("/import/html", {
    method: "POST",
    body: JSON.stringify({ html }),
  });

  await Promise.all([
    getBookmarksBridge().loadBookmarks(),
    getFoldersBridge().loadFolders(),
  ]);

  const hasLog = !!(result.import_log && result.import_log.length > 0);

  if (hasLog && result.import_log) {
    const logContent = result.import_log
      .map(
        (entry: { status: string; url: string; reason?: string }) =>
          `[${entry.status.toUpperCase()}] ${entry.url}${
            entry.reason ? ` (${entry.reason})` : ""
          }`,
      )
      .join("\n");
    const blob = new Blob([logContent], { type: "text/plain" });
    downloadBlob(
      blob,
      `import-log-${new Date().toISOString().split("T")[0]}.txt`,
    );
  }

  return {
    imported: result.imported,
    skipped: result.skipped,
    hasLog,
  };
}

/**
 * Import JSON bookmarks file
 */
export async function importJson(
  file: File,
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  const data = JSON.parse(text);

  const importData =
    data.bookmarks || data.folders
      ? data
      : { bookmarks: Array.isArray(data) ? data : [], folders: [] };

  const result = await api<{
    imported: number;
    skipped: number;
  }>("/import/json", {
    method: "POST",
    body: JSON.stringify(importData),
  });

  await Promise.all([
    getBookmarksBridge().loadBookmarks(),
    getFoldersBridge().loadFolders(),
  ]);

  return {
    imported: result.imported,
    skipped: result.skipped,
  };
}

/**
 * Export as JSON
 */
export async function exportJson(): Promise<void> {
  const data = await api("/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, "anchormarks-bookmarks.json");
}

/**
 * Export as HTML
 */
export async function exportHtml(): Promise<void> {
  const response = await fetch(`${API_BASE}/export?format=html`, {
    credentials: "include",
  });

  if (response.status === 401) {
    getAuthBridge().logout();
    throw new Error("Session expired");
  }

  if (!response.ok) throw new Error("Export failed");

  const blob = await response.blob();
  downloadBlob(blob, "anchormarks-bookmarks.html");
}

/**
 * Reset bookmarks to default
 */
export async function resetBookmarks(): Promise<number> {
  if (
    !(await showConfirm(
      "Reset all bookmarks? This will delete all your bookmarks and folders, and restore the example bookmarks. This cannot be undone!",
      {
        title: "Reset Bookmarks",
        confirmText: "Reset All",
        destructive: true,
      },
    ))
  )
    throw new Error("Cancelled");

  const data = await api<{ bookmarks_created: number }>(
    "/settings/reset-bookmarks",
    { method: "POST" },
  );

  const ui = getUIBridge();
  ui.setCurrentFolder(null);
  ui.setCurrentView("all");

  await Promise.all([
    getFoldersBridge().loadFolders(),
    getBookmarksBridge().loadBookmarks(),
  ]);

  return data.bookmarks_created;
}

/**
 * Export dashboard views and bookmark views as JSON
 */
export async function exportViews(): Promise<{
  dashboard: number;
  bookmark: number;
}> {
  const [dashboardViews, bookmarkViews] = await Promise.all([
    api<any[]>("/dashboard/views"),
    api<any[]>("/bookmark/views"),
  ]);

  if (
    (!dashboardViews || dashboardViews.length === 0) &&
    (!bookmarkViews || bookmarkViews.length === 0)
  ) {
    throw new Error("No views to export");
  }

  const exportData = {
    version: "1.1",
    exported_at: new Date().toISOString(),
    views: dashboardViews || [],
    bookmark_views: bookmarkViews || [],
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, "anchormarks-views.json");

  return {
    dashboard: (dashboardViews || []).length,
    bookmark: (bookmarkViews || []).length,
  };
}

/**
 * Import dashboard views and bookmark views from JSON file
 */
export async function importViews(
  file: File,
): Promise<{ dashboard: number; bookmark: number; skipped: number }> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.views && !data.bookmark_views) {
    throw new Error("Invalid views file format");
  }

  let importedDashboard = 0;
  let importedBookmark = 0;
  let skipped = 0;

  // Import Dashboard Views
  if (data.views && Array.isArray(data.views)) {
    for (const view of data.views) {
      try {
        await api("/dashboard/views", {
          method: "POST",
          body: JSON.stringify({
            name: view.name,
            config: view.config,
          }),
        });
        importedDashboard++;
      } catch (err) {
        console.error(`Failed to import dashboard view "${view.name}":`, err);
        skipped++;
      }
    }
  }

  // Import Bookmark Views
  if (data.bookmark_views && Array.isArray(data.bookmark_views)) {
    for (const view of data.bookmark_views) {
      try {
        await api("/bookmark/views", {
          method: "POST",
          body: JSON.stringify({
            name: view.name,
            config: view.config,
          }),
        });
        importedBookmark++;
      } catch (err) {
        console.error(`Failed to import bookmark view "${view.name}":`, err);
        skipped++;
      }
    }
  }

  return {
    dashboard: importedDashboard,
    bookmark: importedBookmark,
    skipped,
  };
}

export default {
  importHtml,
  importJson,
  exportJson,
  exportHtml,
  resetBookmarks,
  exportViews,
  importViews,
};
