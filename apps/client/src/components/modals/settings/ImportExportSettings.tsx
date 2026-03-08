import React, { useState } from "react";
import { showToast } from "@utils/ui-helpers.ts";
import {
  importHtml,
  importJson,
  exportJson,
  exportHtml,
  exportViews,
  importViews
} from "@features/bookmarks/import-export.ts";

export function ImportExportSettings() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>, type: 'bookmarks' | 'views') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(`Importing ${type}...`);

    try {
      if (type === 'bookmarks') {
        const isHtml = file.name.toLowerCase().endsWith('.html');
        const result = isHtml ? await importHtml(file) : await importJson(file);

        showToast(`Imported ${result.imported} bookmarks!${result.skipped ? ` (${result.skipped} skipped)` : ""}`, "success");
        setImportStatus("Import successful! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const result = await importViews(file);
        const message = `Imported ${result.dashboard} dashboard view(s), ${result.bookmark} bookmark view(s)${result.skipped > 0 ? `, skipped ${result.skipped}` : ""}`;
        showToast(message, "success");
        setImportStatus(message);
      }
    } catch (err: any) {
      showToast(err.message || "Import failed", "error");
      setImportStatus(`Error: ${err.message}`);
    } finally {
      setIsImporting(false);
      e.target.value = ""; // Reset input
    }
  };

  return (
    <div className="import-export-settings">
      <div className="settings-section">
        <h4>Bookmarks</h4>
        <p className="text-tertiary" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
          Export or import your bookmarks. Supports AnchorMarks JSON and standard HTML formats.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <button className="btn btn-outline" onClick={() => exportJson()}>
            Export JSON
          </button>
          <button className="btn btn-outline" onClick={() => exportHtml()}>
            Export HTML
          </button>
        </div>

        <div className="form-group">
          <label>Import Bookmarks (HTML or JSON)</label>
          <input
            type="file"
            className="form-input"
            accept=".json,.html"
            disabled={isImporting}
            onChange={(e) => handleImport(e, 'bookmarks')}
          />
        </div>
      </div>

      <hr style={{ margin: "2rem 0", opacity: 0.1 }} />

      <div className="settings-section">
        <h4>Dashboard & App Views</h4>
        <p className="text-tertiary" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
          Backup your custom dashboard layouts and filtered bookmark views.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <button className="btn btn-outline" onClick={async () => {
            try {
              const res = await exportViews();
              showToast(`Exported ${res.dashboard + res.bookmark} views`, "success");
            } catch (err: any) {
              showToast(err.message, "error");
            }
          }}>
            Export Views
          </button>
        </div>

        <div className="form-group">
          <label>Import Views (JSON)</label>
          <input
            type="file"
            className="form-input"
            accept=".json"
            disabled={isImporting}
            onChange={(e) => handleImport(e, 'views')}
          />
        </div>
      </div>

      {importStatus && (
        <div className={`import-status ${importStatus.startsWith('Error') ? 'error' : 'success'}`} style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
          {importStatus}
        </div>
      )}
    </div>
  );
}
