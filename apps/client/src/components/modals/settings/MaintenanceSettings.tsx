import { useState } from "react";
import { showToast } from "@utils/ui-helpers.ts";
import { api } from "@services/api.ts";

export function MaintenanceSettings() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const runOperation = async (name: string, endpoint: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setStatus(`Running ${name}...`);
    setProgress(10);

    try {
      const result = await api<any>(endpoint, { method: "POST" });
      setProgress(100);
      showToast(`${name} complete: ${result.message || "Success"}`, "success");
    } catch (err: any) {
      showToast(`${name} failed: ${err.message}`, "error");
    } finally {
      setIsRunning(false);
      setTimeout(() => {
        setProgress(0);
        setStatus("");
      }, 2000);
    }
  };

  return (
    <div className="maintenance-settings">
      <div className="settings-section">
        <h4>Bookmark Maintenance</h4>
        <p
          className="text-tertiary"
          style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}
        >
          Keep your library healthy with these cleanup tools.
        </p>

        <div
          className="maintenance-grid"
          style={{ display: "grid", gap: "1rem" }}
        >
          <div
            className="maintenance-card"
            style={{
              padding: "1rem",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <h5>Refresh Favicons</h5>
            <p className="text-tertiary" style={{ fontSize: "0.75rem" }}>
              Re-download icons for all bookmarks.
            </p>
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                runOperation("Favicon Refresh", "/maintenance/refresh-favicons")
              }
              disabled={isRunning}
            >
              Start
            </button>
          </div>

          <div
            className="maintenance-card"
            style={{
              padding: "1rem",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <h5>Find Duplicates</h5>
            <p className="text-tertiary" style={{ fontSize: "0.75rem" }}>
              Identify bookmarks with the same URL.
            </p>
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                runOperation("Duplicate Check", "/maintenance/duplicates")
              }
              disabled={isRunning}
            >
              Scan
            </button>
          </div>

          <div
            className="maintenance-card"
            style={{
              padding: "1rem",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <h5>Check Broken Links</h5>
            <p className="text-tertiary" style={{ fontSize: "0.75rem" }}>
              Verify that all your bookmarks are still reachable.
            </p>
            <button
              className="btn btn-sm btn-outline"
              onClick={() =>
                runOperation("Broken Link Check", "/maintenance/check-links")
              }
              disabled={isRunning}
            >
              Verify
            </button>
          </div>
        </div>

        {isRunning && (
          <div className="maintenance-progress" style={{ marginTop: "2rem" }}>
            <div
              className="text-tertiary"
              style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}
            >
              {status}
            </div>
            <div
              className="progress-bar"
              style={{
                height: "4px",
                backgroundColor: "var(--bg-tertiary)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                className="progress-fill"
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: "var(--primary)",
                  transition: "width 0.3s ease",
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
