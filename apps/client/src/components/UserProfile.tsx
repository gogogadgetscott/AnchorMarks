import React from "react";
import { Icon } from "./Icon.tsx";

interface UserProfileProps {
  name?: string;
  avatarChar?: string;
  plan?: string;
  className?: string;
  onToggleDropdown?: () => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export function UserProfile({
  name = "User",
  avatarChar = "U",
  plan = "Free Plan",
  className = "",
  onToggleDropdown,
  onOpenSettings,
  onLogout,
}: UserProfileProps) {
  return (
    <div className={`user-profile-menu ${className}`}>
      <button
        className="user-avatar-btn header-user-avatar-btn"
        data-action="toggle-user-dropdown"
        onClick={onToggleDropdown}
      >
        <div className="user-avatar header-user-avatar">{avatarChar}</div>
      </button>
      <div className="user-dropdown-menu hidden header-user-dropdown">
        <div className="user-dropdown-header">
          <div className="user-avatar large header-user-avatar-large">
            {avatarChar}
          </div>
          <div className="user-dropdown-info">
            <span className="user-name header-user-name">{name}</span>
            <span className="user-plan">{plan}</span>
          </div>
        </div>
        <div className="user-dropdown-actions">
          <button
            className="dropdown-item header-settings-btn"
            data-action="open-settings"
            onClick={onOpenSettings}
          >
            <Icon name="settings" size={16} />
            Settings
          </button>
          <button
            className="dropdown-item header-logout-btn"
            data-action="logout-user"
            onClick={onLogout}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              style={{ width: 16, height: 16 }}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
