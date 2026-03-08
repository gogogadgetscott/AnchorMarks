import { useState, useEffect } from "react";
import { api } from "@services/api.ts";
import { regenerateApiKey, copyApiKey } from "@features/auth/auth.ts";
import { showToast } from "@utils/ui-helpers.ts";

export function ApiSettings() {
  const [apiKey, setApiKey] = useState("••••••••••••••••");
  const [showKey, setShowKey] = useState(false);

  const handleRegenerate = async () => {
    const newKey = await regenerateApiKey();
    if (newKey) {
      setApiKey(newKey);
      setShowKey(true);
    }
  };

  const handleCopy = () => {
    copyApiKey();
  };

  return (
    <div className="api-settings">
      <div className="settings-section">
        <h4>API Access</h4>
        <p
          className="text-tertiary"
          style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}
        >
          Use your API key to access AnchorMarks from other applications or
          scripts. Keep this key secret!
        </p>

        <div className="form-group">
          <label>Your API Key</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type={showKey ? "text" : "password"}
              className="form-input"
              value={apiKey}
              readOnly
              style={{ flex: 1, fontFamily: "monospace" }}
            />
            <button
              className="btn btn-outline"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button className="btn btn-outline" onClick={handleCopy}>
              Copy
            </button>
          </div>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <button className="btn btn-outline-danger" onClick={handleRegenerate}>
            Regenerate API Key
          </button>
          <p
            className="text-tertiary"
            style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}
          >
            Warning: The old key will stop working immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
