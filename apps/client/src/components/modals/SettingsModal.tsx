import { useModal } from "@/contexts/ModalContext";
import { ProfileSettings } from "./settings/ProfileSettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { TagSettings } from "./settings/TagSettings";
import { ApiSettings } from "./settings/ApiSettings";
import { ImportExportSettings } from "./settings/ImportExportSettings";
import { MaintenanceSettings } from "./settings/MaintenanceSettings";
import { ShortcutSettings } from "./settings/ShortcutSettings";

export default function SettingsModal() {
  const { openModal, closeModal, settingsActiveTab, setSettingsActiveTab } =
    useModal();

  if (openModal !== "settings") return null;

  const tabs = [
    { id: "general", label: "General", icon: "⚙️", section: "App" },
    { id: "profile", label: "Profile", icon: "👤", section: "Account" },
    { id: "tags", label: "Tags", icon: "🏷️", section: "App" },
    { id: "api", label: "API", icon: "🔑", section: "Account" },
    {
      id: "import",
      label: "Import/Export",
      icon: "📤",
      section: "Maintenance",
    },
    {
      id: "maintenance",
      label: "Maintenance",
      icon: "🛠️",
      section: "Maintenance",
    },
    { id: "shortcuts", label: "Shortcuts", icon: "⌨️", section: "App" },
  ];

  const sections = [
    { title: "Account", tabs: tabs.filter((t) => t.section === "Account") },
    { title: "App", tabs: tabs.filter((t) => t.section === "App") },
    {
      title: "Maintenance",
      tabs: tabs.filter((t) => t.section === "Maintenance"),
    },
  ];

  const renderActivePanel = () => {
    switch (settingsActiveTab) {
      case "profile":
        return <ProfileSettings />;
      case "tags":
        return <TagSettings />;
      case "api":
        return <ApiSettings />;
      case "import":
        return <ImportExportSettings />;
      case "maintenance":
        return <MaintenanceSettings />;
      case "shortcuts":
        return <ShortcutSettings />;
      case "general":
      default:
        return <GeneralSettings />;
    }
  };

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
          <div className="header-title-complex">
            <h2 id="settings-modal-title">Settings</h2>
            <span className="text-tertiary">
              Configure your AnchorMarks experience
            </span>
          </div>
          <button
            className="modal-close btn-icon"
            onClick={closeModal}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="modal-body settings-modal-body">
          <div className="settings-layout">
            <aside className="settings-sidebar">
              <nav aria-label="Settings sections">
                {sections.map((section) => (
                  <div key={section.title} className="settings-nav-section">
                    <div className="settings-nav-header">{section.title}</div>
                    {section.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        className={`settings-tab-btn ${
                          settingsActiveTab === tab.id ? "active" : ""
                        }`}
                        onClick={() => setSettingsActiveTab(tab.id)}
                      >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </aside>

            <main className="settings-main-content">{renderActivePanel()}</main>
          </div>
        </div>

        <div className="modal-footer">
          <div className="settings-footer-note">
            <span className="text-tertiary">
              Changes are saved automatically
            </span>
          </div>
          <button className="btn btn-primary" onClick={closeModal}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
