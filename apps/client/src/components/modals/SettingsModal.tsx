import { useRef, useEffect } from "react";
import { useModal } from "@contexts/ModalContext";
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";

/**
 * SettingsModal - Tabbed settings interface
 *
 * For Phase 7, this component provides the modal wrapper and tab navigation.
 * The actual settings form content and handlers are integrated from the existing
 * settings.ts feature and ui-helpers.ts modal management.
 *
 * Tabs:
 * - Profile: Email/password changes
 * - General: Display preferences (theme, favicons, sidebar)
 * - Dashboard: Dashboard widget configuration
 * - Tags: Tag management and stats
 * - API: API key management
 * - Danger: Data reset and destructive operations
 */
export default function SettingsModal() {
  const { closeModal, settingsActiveTab, setSettingsActiveTab } = useModal();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      try {
        createFocusTrap(modalRef.current, {
          initialFocus: true,
          onEscape: closeModal,
        });
      } catch (error) {
        console.warn("Failed to create focus trap for modal", error);
      }
    }

    return () => {
      if (modalRef.current?.id) {
        removeFocusTrap(modalRef.current.id);
      }
    };
  }, [closeModal]);

  const tabs = [
    {
      name: "profile",
      label: "Profile",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      section: "Account",
    },
    {
      name: "general",
      label: "General",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
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
      section: "Customization",
    },
    {
      name: "dashboard",
      label: "Dashboard",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
      section: "Customization",
    },
    {
      name: "tags",
      label: "Tags",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
      section: "Customization",
    },
    {
      name: "api",
      label: "API",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      section: "Integrations",
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
  ];

  return (
    <div
      id="settings-modal"
      className="modal"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      tabIndex={-1}
    >
      <div className="modal-backdrop" onClick={closeModal}></div>
      <div className="modal-content modal-lg">
        <div className="modal-header">
          <h2 id="settings-modal-title">Settings</h2>
          <div
            style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}
          >
            <button
              className="btn btn-sm btn-outline-danger"
              id="logout-btn"
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem" }}
              onClick={closeModal}
            >
              Log Out
            </button>
            <button
              type="button"
              className="btn-icon modal-close"
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
                      key={tab.name}
                      className={`settings-tab ${
                        settingsActiveTab === tab.name ? "active" : ""
                      }`}
                      type="button"
                      onClick={() => setSettingsActiveTab(tab.name)}
                      data-settings-tab={tab.name}
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

          <div className="settings-panels">
            {/* Settings panel content will be injected here */}
            {/* For Phase 7, we keep the existing HTML fragments */}
            <div
              id="settings-profile"
              className={`settings-panel ${
                settingsActiveTab === "profile" ? "active" : ""
              }`}
            ></div>
            <div
              id="settings-general"
              className={`settings-panel ${
                settingsActiveTab === "general" ? "active" : ""
              }`}
            ></div>
            <div
              id="settings-dashboard"
              className={`settings-panel ${
                settingsActiveTab === "dashboard" ? "active" : ""
              }`}
            ></div>
            <div
              id="settings-tags"
              className={`settings-panel ${
                settingsActiveTab === "tags" ? "active" : ""
              }`}
            ></div>
            <div
              id="settings-api"
              className={`settings-panel ${
                settingsActiveTab === "api" ? "active" : ""
              }`}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
