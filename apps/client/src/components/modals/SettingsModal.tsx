import { useModal } from "@/contexts/ModalContext";
import { ProfileSettings } from "./settings/ProfileSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { TagSettings } from "./settings/TagSettings";
import { ApiSettings } from "./settings/ApiSettings";
import { ImportExportSettings } from "./settings/ImportExportSettings";
import { MaintenanceSettings } from "./settings/MaintenanceSettings";
import { ShortcutSettings } from "./settings/ShortcutSettings";
import { SyncSettings } from "./settings/SyncSettings";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsModal() {
  const { openModal, closeModal, settingsActiveTab, setSettingsActiveTab } =
    useModal();
  const { logout } = useAuth();

  if (openModal !== "settings") return null;

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      section: "Account",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "general",
      label: "General",
      section: "Customization",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      ),
    },
    {
      id: "tags",
      label: "Tags",
      section: "Customization",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
    },
    {
      id: "api",
      label: "API Access",
      section: "Integrations",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      ),
    },
    {
      id: "sync",
      label: "Browser Helper",
      section: "Integrations",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
    },
    {
      id: "import",
      label: "Import/Export",
      section: "Integrations",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      id: "maintenance",
      label: "Maintenance",
      section: "System Tools",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      id: "shortcuts",
      label: "Keyboard Shortcuts",
      section: "System Tools",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <line x1="6" y1="8" x2="6.01" y2="8" />
          <line x1="10" y1="8" x2="10.01" y2="8" />
          <line x1="14" y1="8" x2="14.01" y2="8" />
          <line x1="18" y1="8" x2="18.01" y2="8" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="12" y2="16" />
        </svg>
      ),
    },
  ];

  const sections = [
    { title: "Account", tabs: tabs.filter((t) => t.section === "Account") },
    {
      title: "Customization",
      tabs: tabs.filter((t) => t.section === "Customization"),
    },
    {
      title: "Integrations",
      tabs: tabs.filter((t) => t.section === "Integrations"),
    },
    {
      title: "System Tools",
      tabs: tabs.filter((t) => t.section === "System Tools"),
    },
  ];

  return (
    <div
      className="modal show"
      id="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      style={{ display: "flex" }}
    >
      <div className="modal-backdrop" onClick={closeModal}></div>
      <div className="modal-content modal-lg settings-modal-content">
        <div className="modal-header">
          <h2 id="settings-modal-title">Settings</h2>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={logout}
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
            >
              Log Out
            </button>
            <button
              className="modal-close btn-icon"
              onClick={closeModal}
              aria-label="Close settings"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="settings-content">
          <nav className="settings-tabs" aria-label="Settings sections">
            <div className="settings-tabs-inner">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="settings-section-header" aria-hidden="true">
                    {section.title}
                  </p>
                  {section.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={`settings-tab ${
                        settingsActiveTab === tab.id ? "active" : ""
                      }`}
                      onClick={() => setSettingsActiveTab(tab.id)}
                      data-settings-tab={tab.id}
                      type="button"
                    >
                      <span className="settings-tab-icon" aria-hidden="true">
                        {tab.icon}
                      </span>
                      <span className="settings-tab-label">{tab.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div
            className={`settings-panel ${settingsActiveTab === "profile" ? "active" : ""}`}
            id="settings-profile"
          >
            <ProfileSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "general" ? "active" : ""}`}
            id="settings-general"
          >
            <GeneralSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "tags" ? "active" : ""}`}
            id="settings-tags"
          >
            <TagSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "api" ? "active" : ""}`}
            id="settings-api"
          >
            <ApiSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "sync" ? "active" : ""}`}
            id="settings-sync"
          >
            <SyncSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "import" ? "active" : ""}`}
            id="settings-import"
          >
            <ImportExportSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "maintenance" ? "active" : ""}`}
            id="settings-maintenance"
          >
            <MaintenanceSettings />
          </div>
          <div
            className={`settings-panel ${settingsActiveTab === "shortcuts" ? "active" : ""}`}
            id="settings-shortcuts"
          >
            <ShortcutSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
