import { Icon } from "./Icon.ts";

interface UserProfileOptions {
  name?: string;
  avatarChar?: string;
  plan?: string;
  className?: string;
}

/**
 * Component for rendering the user profile menu and dropdown.
 * @param {object} options - Optional parameters:
 *   @param {string} options.name - User name.
 *   @param {string} options.avatarChar - Character for the avatar.
 *   @param {string} options.plan - User plan description.
 *   @param {string} options.className - Additional CSS classes for the container.
 * @returns {string} - HTML string of the user profile component.
 */
export function UserProfile(options: UserProfileOptions = {}): string {
  const {
    name = "User",
    avatarChar = "U",
    plan = "Free Plan",
    className = "",
  } = options;

  return `
    <div class="user-profile-menu ${className}">
      <button class="user-avatar-btn header-user-avatar-btn">
        <div class="user-avatar header-user-avatar">${avatarChar}</div>
      </button>
      <div class="user-dropdown-menu hidden header-user-dropdown">
        <div class="user-dropdown-header">
          <div class="user-avatar large header-user-avatar-large">${avatarChar}</div>
          <div class="user-dropdown-info">
            <span class="user-name header-user-name">${name}</span>
            <span class="user-plan">${plan}</span>
          </div>
        </div>
        <div class="user-dropdown-actions">
          <button class="dropdown-item header-settings-btn">
            ${Icon("settings", { size: 16 })}
            Settings
          </button>
          <button class="dropdown-item header-logout-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  `;
}
