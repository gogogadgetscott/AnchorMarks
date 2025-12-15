/**
 * AnchorMarks - Import/Export Module
 * Handles bookmark import and export functionality
 */

import * as state from "./state.js";
import { api } from "./api.js";
import { downloadBlob } from "./utils.js";
import { showToast, closeModals } from "./ui.js";
import { loadBookmarks } from "./bookmarks.js";
import { loadFolders } from "./folders.js";

// Import HTML bookmarks file
export async function importHtml(file) {
  const html = await file.text();
  setImportProgress("start");
  try {
    const result = await api("/import/html", {
      method: "POST",
      body: JSON.stringify({ html }),
    });

    // Reload data
    await loadBookmarks();
    await loadFolders();

    // Update tag list
    const { renderSidebarTags } = await import("./search.js");
    await renderSidebarTags();

    showToast(`Imported ${result.imported} bookmarks!`, "success");
    setImportProgress("success", `${result.imported} bookmarks imported.`);
  } catch (err) {
    showToast(err.message, "error");
    setImportProgress("error", err.message);
  } finally {
    setImportProgress("idle");
  }
}

// Export as JSON
export async function exportJson() {
  try {
    const data = await api("/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "anchormarks-bookmarks.json");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Export as HTML
export async function exportHtml() {
  try {
    const response = await fetch(`${state.API_BASE}/export?format=html`, {
      credentials: "include",
    });

    if (response.status === 401) {
      const { logout } = await import("./auth.js");
      logout();
      throw new Error("Session expired");
    }

    if (!response.ok) throw new Error("Export failed");

    const blob = await response.blob();
    downloadBlob(blob, "anchormarks-bookmarks.html");
    showToast("Export successful", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Reset bookmarks to default
export async function resetBookmarks() {
  if (
    !confirm(
      "Reset all bookmarks? This will delete all your bookmarks and folders, and restore the example bookmarks. This cannot be undone!",
    )
  )
    return;

  try {
    const data = await api("/settings/reset-bookmarks", { method: "POST" });
    state.setCurrentFolder(null);
    state.setCurrentView("all");

    const viewTitle = document.getElementById("view-title");
    if (viewTitle) viewTitle.textContent = "Bookmarks";

    await Promise.all([loadFolders(), loadBookmarks()]);

    const { updateActiveNav } = await import("./ui.js");
    updateActiveNav();
    closeModals();
    showToast(
      `Bookmarks reset! ${data.bookmarks_created} example bookmarks created.`,
      "success",
    );
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Export dashboard views as JSON
export async function exportDashboardViews() {
  try {
    const views = await api("/dashboard/views");
    if (!views || views.length === 0) {
      showToast("No dashboard views to export", "info");
      return;
    }
    
    const exportData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      views: views
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "anchormarks-dashboard-views.json");
    showToast(`Exported ${views.length} dashboard view(s)`, "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Import dashboard views from JSON file
export async function importDashboardViews(file) {
  setDashboardImportProgress("start");
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    // Validate format
    if (!data.views || !Array.isArray(data.views)) {
      throw new Error("Invalid dashboard views file format");
    }
    
    let imported = 0;
    let skipped = 0;
    
    // Import each view
    for (const view of data.views) {
      try {
        // Create new view (exclude id, user_id, created_at, updated_at)
        await api("/dashboard/views", {
          method: "POST",
          body: JSON.stringify({
            name: view.name,
            config: view.config
          }),
        });
        imported++;
      } catch (err) {
        console.error(`Failed to import view "${view.name}":`, err);
        skipped++;
      }
    }
    
    const message = `Imported ${imported} view(s)${skipped > 0 ? `, skipped ${skipped}` : ""}`;
    showToast(message, "success");
    setDashboardImportProgress("success", message);
  } catch (err) {
    showToast(err.message, "error");
    setDashboardImportProgress("error", err.message);
  } finally {
    setDashboardImportProgress("idle");
  }
}

export default {
  importHtml,
  exportJson,
  exportHtml,
  resetBookmarks,
  exportDashboardViews,
  importDashboardViews,
};

function setImportProgress(state, message = "") {
  const statusEl = document.getElementById("import-html-progress");
  const btn = document.getElementById("import-html-btn");
  if (!statusEl || !btn) return;

  const setStatus = (content) => {
    statusEl.innerHTML = content;
  };

  switch (state) {
    case "start": {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      setStatus(
        `<span class="spinner" aria-hidden="true"></span><span>Importing bookmarks...</span>`,
      );
      break;
    }
    case "success": {
      setStatus(`<span class="success-dot" aria-hidden="true"></span><span>${message || "Import complete"}</span>`);
      break;
    }
    case "error": {
      setStatus(`<span class="error-dot" aria-hidden="true"></span><span>${message || "Import failed"}</span>`);
      break;
    }
    case "idle": {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      break;
    }
    default: {
      setStatus("");
    }
  }
}

function setDashboardImportProgress(state, message = "") {
  const statusEl = document.getElementById("import-dashboard-views-progress");
  const btn = document.getElementById("import-dashboard-views-btn");
  if (!statusEl || !btn) return;

  const setStatus = (content) => {
    statusEl.innerHTML = content;
  };

  switch (state) {
    case "start": {
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      setStatus(
        `<span class="spinner" aria-hidden="true"></span><span>Importing dashboard views...</span>`,
      );
      break;
    }
    case "success": {
      setStatus(`<span class="success-dot" aria-hidden="true"></span><span>${message || "Import complete"}</span>`);
      break;
    }
    case "error": {
      setStatus(`<span class="error-dot" aria-hidden="true"></span><span>${message || "Import failed"}</span>`);
      break;
    }
    case "idle": {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      break;
    }
    default: {
      setStatus("");
    }
  }
}
