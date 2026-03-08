import { showToast } from "@utils/ui-helpers.ts";
import { api } from "@services/api.ts";

export function ImportExportSettings() {
  const handleExport = async () => {
    try {
      window.location.href = "/api/maintenance/export";
      showToast("Preparing export...", "info");
    } catch (err) {
      showToast("Export failed", "error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      showToast("Importing bookmarks...", "info");
      const response = await fetch("/api/maintenance/import", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        showToast(`Imported ${result.count} bookmarks!`, "success");
        // Reload page or data
        window.location.reload();
      } else {
        showToast(result.error || "Import failed", "error");
      }
    } catch (err) {
      showToast("Import failed", "error");
    }
  };

  return (
    <div className="import-export-settings">
      <div className="settings-section">
        <h4>Export Data</h4>
        <p
          className="text-tertiary"
          style={{ fontSize: "0.85rem", marginBottom: "1rem" }}
        >
          Download all your bookmarks, folders, and tags as a JSON file.
        </p>
        <button className="btn btn-outline" onClick={handleExport}>
          Export as JSON
        </button>
      </div>

      <div className="settings-section" style={{ marginTop: "2rem" }}>
        <h4>Import Data</h4>
        <p
          className="text-tertiary"
          style={{ fontSize: "0.85rem", marginBottom: "1rem" }}
        >
          Upload an AnchorMarks JSON export or a standard Netscape/HTML
          bookmarks file.
        </p>
        <div className="form-group">
          <input
            type="file"
            id="import-file"
            className="form-input"
            accept=".json,.html"
            onChange={handleImport}
          />
        </div>
      </div>
    </div>
  );
}
