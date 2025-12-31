/**
 * AnchorMarks - Import/Export Module
 * Handles bookmark import and export functionality
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { downloadBlob } from "@utils/index.ts";
import { showToast, closeModals } from "@utils/ui-helpers.ts";
import { confirmDialog } from "@features/ui/confirm-dialog.ts";

// Import HTML bookmarks file
export async function importHtml(file: File): Promise<void> {
  const html = await file.text();
  setImportProgress("start");
  try {
    const result = await api<{
      imported: number;
      skipped: number;
      import_log?: Array<{ status: string; url: string; reason?: string }>;
    }>("/import/html", {
      method: "POST",
      body: JSON.stringify({ html }),
    });

    // Reload data
    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
    await loadBookmarks();
    await loadBookmarks();
    const { loadFolders } = await import("@features/bookmarks/folders.ts");
    await loadFolders();

    // Update tag list
    const { renderSidebarTags } = await import("@features/bookmarks/search.ts");
    await renderSidebarTags();

    const hasLog = result.import_log && result.import_log.length > 0;

    showToast(
      `Imported ${result.imported} bookmarks!${
        result.skipped ? ` (${result.skipped} skipped)` : ""
      }${hasLog ? ". Log file downloaded." : ""}`,
      "success",
    );

    setImportProgress(
      "success",
      `${result.imported} imported${
        result.skipped ? `, ${result.skipped} skipped` : ""
      }.`,
    );

    if (hasLog && result.import_log) {
      const logContent = result.import_log
        .map(
          (entry: any) =>
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
  } catch (err: any) {
    showToast(err.message, "error");
    setImportProgress("error", err.message);
  } finally {
    setImportProgress("idle");
  }
}
// Import JSON bookmarks file
export async function importJson(file: File): Promise<void> {
  setJsonImportProgress("start");
  try {
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

    const [{ loadBookmarks }, { loadFolders }] = await Promise.all([
      import("@features/bookmarks/bookmarks.ts"),
      import("@features/bookmarks/folders.ts"),
    ]);
    await Promise.all([loadBookmarks(), loadFolders()]);

    const { renderSidebarTags } = await import("@features/bookmarks/search.ts");
    await renderSidebarTags();

    showToast(
      `Imported ${result.imported} bookmarks!${
        result.skipped ? ` (${result.skipped} skipped)` : ""
      }`,
      "success",
    );

    setJsonImportProgress(
      "success",
      `${result.imported} imported${
        result.skipped ? `, ${result.skipped} skipped` : ""
      }.`,
    );
  } catch (err: any) {
    showToast(err.message, "error");
    setJsonImportProgress("error", err.message);
  } finally {
    setJsonImportProgress("idle");
  }
}

// Export as JSON
export async function exportJson(): Promise<void> {
  try {
    const data = await api("/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "anchormarks-bookmarks.tson");
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Export as HTML
export async function exportHtml(): Promise<void> {
  try {
    const response = await fetch(`${state.API_BASE}/export?format=html`, {
      credentials: "include",
    });

    if (response.status === 401) {
      const { logout } = await import("@features/auth/auth.ts");
      logout();
      throw new Error("Session expired");
    }

    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    downloadBlob(blob, "anchormarks-bookmarks.html");
    showToast("Export successful", "success");
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Reset bookmarks to default
export async function resetBookmarks(): Promise<void> {
  if (
    !(await confirmDialog(
      "Reset all bookmarks? This will delete all your bookmarks and folders, and restore the example bookmarks. This cannot be undone!",
      {
        title: "Reset Bookmarks",
        confirmText: "Reset All",
        destructive: true,
      },
    ))
  )
    return;

  try {
    const data = await api<{ bookmarks_created: number }>(
      "/settings/reset-bookmarks",
      { method: "POST" },
    );
    state.setCurrentFolder(null);
    state.setCurrentView("all");

    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Bookmarks";

    const [{ loadFolders }, { loadBookmarks }] = await Promise.all([
      import("@features/bookmarks/folders.ts"),
      import("@features/bookmarks/bookmarks.ts"),
    ]);
    await Promise.all([loadFolders(), loadBookmarks()]);

    const { updateActiveNav } = await import("@utils/ui-helpers.ts");
    updateActiveNav();
    closeModals();
    showToast(
      `Bookmarks reset! ${data.bookmarks_created} example bookmarks created.`,
      "success",
    );
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Export dashboard views and bookmark views as JSON
export async function exportViews(): Promise<void> {
  try {
    const [dashboardViews, bookmarkViews] = await Promise.all([
      api<any[]>("/dashboard/views"),
      api<any[]>("/bookmark/views"),
    ]);

    if (
      (!dashboardViews || dashboardViews.length === 0) &&
      (!bookmarkViews || bookmarkViews.length === 0)
    ) {
      showToast("No views to export", "info");
      return;
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
    showToast(
      `Exported ${exportData.views.length} dashboard view(s) and ${exportData.bookmark_views.length} bookmark view(s)`,
      "success",
    );
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Import dashboard views and bookmark views from JSON file
export async function importViews(file: File): Promise<void> {
  setViewsImportProgress("start");
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate format (support both old format with just 'views' and new format)
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
          // Create new view (exclude id, user_id, created_at, updated_at)
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

    const message = `Imported ${importedDashboard} dashboard view(s), ${importedBookmark} bookmark view(s)${
      skipped > 0 ? `, skipped ${skipped}` : ""
    }`;
    showToast(message, "success");
    showToast(message, "success");
    setViewsImportProgress("success", message);
  } catch (err: any) {
    showToast(err.message, "error");
    setViewsImportProgress("error", err.message);
  } finally {
    setViewsImportProgress("idle");
  }
}

function setImportProgress(
  statusState: "start" | "success" | "error" | "idle",
  message = "",
): void {
  const statusEl = document.getElementById("import-html-progress");
  const btn = document.getElementById("import-html-btn") as HTMLButtonElement;
  if (!statusEl || !btn) return;

  const setStatus = (content: string) => {
    statusEl.innerHTML = content;
  };

  switch (statusState) {
    case "start": {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      setStatus(
        `<span class="spinner" aria-hidden="true"></span><span>Importing bookmarks...</span>`,
      );
      break;
    }
    case "success": {
      setStatus(
        `<span class="success-dot" aria-hidden="true"></span><span>${message || "Import complete"}</span>`,
      );
      break;
    }
    case "error": {
      setStatus(
        `<span class="error-dot" aria-hidden="true"></span><span>${message || "Import failed"}</span>`,
      );
      break;
    }
    case "idle": {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      break;
    }
  }
}

function setViewsImportProgress(
  statusState: "start" | "success" | "error" | "idle",
  message = "",
): void {
  const statusEl = document.getElementById("import-views-progress");
  const btn = document.getElementById(
    "import-views-btn",
  ) as HTMLButtonElement;
  if (!statusEl || !btn) return;

  const setStatus = (content: string) => {
    statusEl.innerHTML = content;
  };

  switch (statusState) {
    case "start": {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      setStatus(
        `<span class="spinner" aria-hidden="true"></span><span>Importing views...</span>`,
      );
      break;
    }
    case "success": {
      setStatus(
        `<span class="success-dot" aria-hidden="true"></span><span>${message || "Import complete"}</span>`,
      );
      break;
    }
    case "error": {
      setStatus(
        `<span class="error-dot" aria-hidden="true"></span><span>${message || "Import failed"}</span>`,
      );
      break;
    }
    case "idle": {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      break;
    }
  }
}

function setJsonImportProgress(
  statusState: "start" | "success" | "error" | "idle",
  message = "",
): void {
  const statusEl = document.getElementById("import-json-progress");
  const btn = document.getElementById("import-json-btn") as HTMLButtonElement;
  if (!statusEl || !btn) return;

  const setStatus = (content: string) => {
    statusEl.innerHTML = content;
  };

  switch (statusState) {
    case "start": {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      setStatus(
        `<span class="spinner" aria-hidden="true"></span><span>Importing JSON bookmarks...</span>`,
      );
      break;
    }
    case "success": {
      setStatus(
        `<span class="success-dot" aria-hidden="true"></span><span>${message || "Import complete"}</span>`,
      );
      break;
    }
    case "error": {
      setStatus(
        `<span class="error-dot" aria-hidden="true"></span><span>${message || "Import failed"}</span>`,
      );
      break;
    }
    case "idle": {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      break;
    }
  }
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
