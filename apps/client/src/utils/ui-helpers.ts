/**
 * AnchorMarks - UI Module
 * Handles modals, toasts, and general UI functions
 */

import * as state from "@features/state.ts";
import {
  escapeHtml,
  parseTagInput,
  pluralize,
  safeLocalStorage,
} from "@utils/index.ts";
import { api } from "@services/api.ts";
import { logger } from "@utils/logger.ts";
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";

// Profile settings form HTML template (injected dynamically to avoid password manager detection)
const PROFILE_FORM_HTML = `
  <div style="margin-bottom: 1.5rem">
    <div class="setting-info" style="margin-bottom: 0.5rem">
      <h4>Update Profile</h4>
      <p>Change your email address</p>
    </div>
    <form id="profile-email-form" style="display: flex; gap: 0.5rem">
      <input
        type="email"
        id="profile-email"
        required
        autocomplete="email"
        placeholder="New email address"
        style="flex: 1"
      />
      <button type="submit" class="btn btn-primary">Update</button>
    </form>
  </div>

  <div
    style="
      margin-bottom: 1.5rem;
      border-top: 1px solid var(--border-color);
      padding-top: 1.5rem;
    "
  >
    <div class="setting-info" style="margin-bottom: 0.5rem">
      <h4>Change Password</h4>
      <p>Ensure your account stays secure</p>
    </div>
    <form id="profile-password-form">
      <!-- Accessibility Fix: Hidden Username -->
      <input
        type="text"
        name="username"
        autocomplete="username"
        style="display: none"
      />
      <div
        style="
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        "
      >
        <div class="form-group" style="flex: 1; min-width: 200px">
          <label for="profile-current-password" style="font-size: 0.85rem"
            >Current Password</label
          >
          <input
            type="password"
            id="profile-current-password"
            required
            autocomplete="current-password"
          />
        </div>
        <div class="form-group" style="flex: 1; min-width: 200px">
          <label for="profile-new-password" style="font-size: 0.85rem"
            >New Password</label
          >
          <input
            type="password"
            id="profile-new-password"
            required
            minlength="6"
            autocomplete="new-password"
          />
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end">
        <button type="submit" class="btn btn-primary">
          Change Password
        </button>
      </div>
    </form>
  </div>
`;

// DOM Element references (initialized on DOMContentLoaded)
export const dom: {
  authScreen: HTMLElement | null;
  mainApp: HTMLElement | null;
  loginForm: HTMLFormElement | null;
  registerForm: HTMLFormElement | null;
  authTabs: NodeListOf<HTMLElement> | null;
  mainViewOutlet: HTMLElement | null;
  emptyState: HTMLElement | null;
  searchInput: HTMLInputElement | null;
  viewTitle: HTMLElement | null;
  viewCount: HTMLElement | null;
  bookmarkUrlInput: HTMLInputElement | null;
  bookmarkTagsInput: HTMLInputElement | null;
  tagSuggestions: HTMLElement | null;
  tagStatsList: HTMLElement | null;
  tagRenameFrom: HTMLInputElement | null;
  tagRenameTo: HTMLInputElement | null;
  tagRenameBtn: HTMLButtonElement | null;
  tagRenameUndoBtn: HTMLButtonElement | null;
} = {
  authScreen: null,
  mainApp: null,
  loginForm: null,
  registerForm: null,
  authTabs: null,
  mainViewOutlet: null,
  emptyState: null,
  searchInput: null,
  viewTitle: null,
  viewCount: null,
  bookmarkUrlInput: null,
  bookmarkTagsInput: null,
  tagSuggestions: null,
  tagStatsList: null,
  tagRenameFrom: null,
  tagRenameTo: null,
  tagRenameBtn: null,
  tagRenameUndoBtn: null,
};

// Initialize DOM references
export function initDom(): void {
  dom.authScreen = document.getElementById("auth-screen");
  dom.mainApp = document.getElementById("main-app");
  dom.loginForm = document.getElementById("login-form") as HTMLFormElement;
  dom.registerForm = document.getElementById(
    "register-form",
  ) as HTMLFormElement;
  dom.authTabs = document.querySelectorAll(".auth-tab");
  dom.mainViewOutlet = document.getElementById("main-view-outlet");
  dom.emptyState = document.getElementById("empty-state");
  dom.searchInput = document.getElementById("search-input") as HTMLInputElement;
  dom.viewTitle = document.getElementById("view-title");
  dom.viewCount = document.getElementById("view-count");
  dom.bookmarkUrlInput = document.getElementById(
    "bookmark-url",
  ) as HTMLInputElement;
  dom.bookmarkTagsInput = document.getElementById(
    "bookmark-tags",
  ) as HTMLInputElement;
  dom.tagSuggestions = document.getElementById("tag-suggestions");
  dom.tagStatsList = document.getElementById("tag-stats-list");
  dom.tagRenameFrom = document.getElementById(
    "tag-rename-from",
  ) as HTMLInputElement;
  dom.tagRenameTo = document.getElementById(
    "tag-rename-to",
  ) as HTMLInputElement;
  dom.tagRenameBtn = document.getElementById(
    "tag-rename-btn",
  ) as HTMLButtonElement;
  dom.tagRenameUndoBtn = document.getElementById(
    "tag-rename-undo-btn",
  ) as HTMLButtonElement;
}

// Show toast notification
export function showToast(message: string, type: string = ""): void {
  const toast = document.getElementById("toast");
  if (!toast) return;
  const msgEl = toast.querySelector(".toast-message");
  if (msgEl) msgEl.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

// Inject profile forms dynamically to avoid password manager detection
function injectProfileForms(): void {
  const profilePanel = document.getElementById("settings-profile");
  if (!profilePanel) return;

  // Only inject if forms don't already exist
  const emailForm = profilePanel.querySelector("#profile-email-form");
  if (emailForm) return; // Already injected

  // Inject the form HTML
  profilePanel.innerHTML = PROFILE_FORM_HTML;

  // Attach email update handler
  const emailUpdateForm = document.getElementById(
    "profile-email-form",
  ) as HTMLFormElement;
  if (emailUpdateForm) {
    emailUpdateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById(
        "profile-email",
      ) as HTMLInputElement;
      const newEmail = emailInput.value.trim();

      if (!newEmail) return;

      try {
        await api("/auth/update-email", {
          method: "POST",
          body: JSON.stringify({ email: newEmail }),
        });
        showToast("Email updated successfully", "success");
        emailInput.value = "";
      } catch (err) {
        showToast((err as Error).message || "Failed to update email", "error");
      }
    });
  }

  // Attach password change handler
  const passwordForm = document.getElementById(
    "profile-password-form",
  ) as HTMLFormElement;
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentPassword = (
        document.getElementById("profile-current-password") as HTMLInputElement
      ).value;
      const newPassword = (
        document.getElementById("profile-new-password") as HTMLInputElement
      ).value;

      if (!currentPassword || !newPassword) {
        showToast("Please fill in all fields", "error");
        return;
      }

      try {
        await api("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        showToast("Password changed successfully", "success");
        passwordForm.reset();
      } catch (err) {
        showToast(
          (err as Error).message || "Failed to change password",
          "error",
        );
      }
    });
  }
}

// Open modal
export function openModal(id: string): void {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");

    // Add ARIA attributes for accessibility
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    // Set aria-labelledby if modal has a title
    const modalTitle = modal.querySelector(".modal-title, h2, h3");
    if (modalTitle && modalTitle.id) {
      modal.setAttribute("aria-labelledby", modalTitle.id);
    } else if (modalTitle) {
      // Generate an ID for the title if it doesn't have one
      const titleId = `${id}-title`;
      modalTitle.id = titleId;
      modal.setAttribute("aria-labelledby", titleId);
    }

    // Create focus trap for the modal
    try {
      // For tag-modal and folder-modal, only close that modal on Escape (don't close parent)
      // For other modals, close only that modal (not all modals)
      const isNestableModal = ["tag-modal", "folder-modal"].includes(id);
      const onEscapeHandler = () => {
        modal.classList.add("hidden");
        // Only reset forms for certain modals
        if (["bookmark-modal", "settings-modal"].includes(id)) {
          resetForms();
        }
      };

      createFocusTrap(modal, {
        initialFocus: true,
        onEscape: onEscapeHandler,
      });
    } catch (error) {
      logger.warn("Failed to create focus trap for modal", error);
    }

    // Attach modal close listeners only once per modal instance
    const closeBtn = modal.querySelector(".modal-close") as HTMLElement | null;
    const cancelBtn = modal.querySelector(
      ".modal-cancel",
    ) as HTMLElement | null;
    const backdrop = modal.querySelector(
      ".modal-backdrop",
    ) as HTMLElement | null;

    const closeHandler = (e: Event) => {
      e.preventDefault();
      modal.classList.add("hidden");

      // Only reset forms for certain modals (not child modals like tag-modal)
      // tag-modal and folder-modal are ephemeral overlays that don't need form reset
      const shouldResetForms = ["bookmark-modal", "settings-modal"].includes(
        id,
      );
      if (shouldResetForms) {
        resetForms();
      }
    };

    // Remove existing listeners to avoid duplicates
    if (closeBtn) {
      closeBtn.replaceWith(closeBtn.cloneNode(true));
      const newCloseBtn = modal.querySelector(
        ".modal-close",
      ) as HTMLElement | null;
      if (newCloseBtn) {
        newCloseBtn.addEventListener("click", closeHandler);
      }
    }

    // Handle Cancel button
    if (cancelBtn) {
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      const newCancelBtn = modal.querySelector(
        ".modal-cancel",
      ) as HTMLElement | null;
      if (newCancelBtn) {
        newCancelBtn.addEventListener("click", closeHandler);
      }
    }

    if (backdrop) {
      backdrop.replaceWith(backdrop.cloneNode(true));
      const newBackdrop = modal.querySelector(
        ".modal-backdrop",
      ) as HTMLElement | null;
      if (newBackdrop) {
        newBackdrop.addEventListener("click", closeHandler);
      }
    }

    // Re-attach settings tab listeners if opening settings modal
    if (id === "settings-modal") {
      // Reset to General tab on every open to prevent stale active-panel state
      document.querySelectorAll(".settings-panel").forEach((p) => {
        p.classList.remove("active");
        (p as HTMLElement).style.display = "none !important";
      });
      document
        .querySelectorAll(".settings-tab")
        .forEach((t) => t.classList.remove("active"));
      const generalPanel = document.getElementById("settings-general");
      if (generalPanel) {
        generalPanel.classList.add("active");
        (generalPanel as HTMLElement).style.display = "flex !important";
      }
      const generalTab = document.querySelector(
        '[data-settings-tab="general"]',
      );
      if (generalTab) generalTab.classList.add("active");

      injectProfileForms(); // Inject profile forms before attaching listeners
      attachSettingsTabListeners();
      attachSettingsModalLogout();
    }

    // Re-initialize tag input if opening bookmark modal
    if (id === "bookmark-modal") {
      import("@features/bookmarks/tag-input.ts").then(({ initTagInput }) => {
        initTagInput();
      });
    }
  }
}

// Attach settings tab listeners
function attachSettingsTabListeners(): void {
  const handleTabClick = (tab: Element) => {
    return () => {
      const tabName = (tab as HTMLElement).dataset.settingsTab;
      if (!tabName) return;

      // Remove active class from all tabs and panels
      document.querySelectorAll(".settings-tab").forEach((t) => {
        t.classList.remove("active");
      });
      document.querySelectorAll(".settings-panel").forEach((p) => {
        p.classList.remove("active");
        (p as HTMLElement).style.display = "none !important";
      });

      // Add active class to clicked tab and corresponding panel
      tab.classList.add("active");
      const panelId = `settings-${tabName}`;
      const panel = document.getElementById(panelId);
      if (panel) {
        panel.classList.add("active");
        (panel as HTMLElement).style.display = "flex !important";
      }

      // Load tag stats when the Tags tab is activated
      if (tabName === "tags") {
        import("@features/bookmarks/search.ts").then(({ loadTagStats }) => {
          loadTagStats();
        });

        // Initialize tag-specific controls only on tags tab
        initializeTagControls();
      }
    };
  };

  // Attach click listeners to all settings tabs
  document.querySelectorAll(".settings-tab").forEach((tab) => {
    // Remove any previously attached listeners by cloning and replacing
    const fresh = tab.cloneNode(true) as HTMLElement;
    if (tab.parentNode) {
      tab.parentNode.replaceChild(fresh, tab);
    }
    // Attach new listener to the fresh clone
    fresh.addEventListener("click", handleTabClick(fresh));
  });

  // Theme selector
  const themeSelect = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement;
  if (themeSelect) {
    themeSelect.addEventListener("change", async (e) => {
      const { setTheme } = await import("@features/bookmarks/settings.ts");
      const themeName = (e.target as HTMLSelectElement).value;
      setTheme(themeName, true); // true = save to server
    });
  }

  // Initialize General panel toggle values from current state
  const faviconToggleInit = document.getElementById(
    "hide-favicons-toggle",
  ) as HTMLInputElement | null;
  if (faviconToggleInit) faviconToggleInit.checked = !state.hideFavicons;

  const richPreviewToggleInit = document.getElementById(
    "rich-link-previews-toggle",
  ) as HTMLInputElement | null;
  if (richPreviewToggleInit)
    richPreviewToggleInit.checked = state.richLinkPreviewsEnabled;

  const childToggleInit = document.getElementById(
    "include-children-toggle",
  ) as HTMLInputElement | null;
  if (childToggleInit) childToggleInit.checked = state.includeChildBookmarks;

  // Favicons toggle
  const faviconToggle = document.getElementById(
    "hide-favicons-toggle",
  ) as HTMLInputElement;
  if (faviconToggle) {
    faviconToggle.addEventListener("change", async (e) => {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      const enabled = (e.target as HTMLInputElement).checked;
      await saveSettings({ hide_favicons: !enabled });

      // Apply the change immediately
      state.setHideFavicons(!enabled);

      const { renderBookmarks } =
        await import("@features/bookmarks/bookmarks.ts");
      renderBookmarks();
    });
  }

  // Rich link previews toggle
  const richPreviewToggle = document.getElementById(
    "rich-link-previews-toggle",
  ) as HTMLInputElement;
  if (richPreviewToggle) {
    richPreviewToggle.addEventListener("change", async (e) => {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      const enabled = (e.target as HTMLInputElement).checked;
      await saveSettings({ rich_link_previews_enabled: enabled });

      // Apply the change immediately
      state.setRichLinkPreviewsEnabled(enabled);

      const { renderBookmarks } =
        await import("@features/bookmarks/bookmarks.ts");
      renderBookmarks();
    });
  }

  // Include children toggle
  const childToggle = document.getElementById(
    "include-children-toggle",
  ) as HTMLInputElement;
  if (childToggle) {
    childToggle.addEventListener("change", async (e) => {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      const enabled = (e.target as HTMLInputElement).checked;
      state.setIncludeChildBookmarks(enabled);
      await saveSettings({ include_child_bookmarks: enabled ? 1 : 0 });
      if (state.currentView === "folder" || state.currentView === "dashboard") {
        const { loadBookmarks } =
          await import("@features/bookmarks/bookmarks.ts");
        loadBookmarks();
      }
    });
  }

  // Bookmark shortcut (drag-to-bookmarks-bar)
  import("@features/bookmarks/settings.ts").then(
    ({ installBookmarkShortcut }) => {
      installBookmarkShortcut();
    },
  );
}

// Initialize tag-specific controls (only when tags tab is active)
function initializeTagControls(): void {
  // Set AI suggestions toggle state and attach listener
  const aiToggleEl = document.getElementById(
    "ai-suggestions-toggle",
  ) as HTMLInputElement | null;
  if (aiToggleEl) {
    aiToggleEl.checked = state.aiSuggestionsEnabled;
    aiToggleEl.addEventListener("change", async (e) => {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      const enabled = (e.target as HTMLInputElement).checked;
      await saveSettings({ ai_suggestions_enabled: enabled });
      state.setAiSuggestionsEnabled(enabled);
    });
  }

  // Initialize tag cloud max tags control
  const maxTagsInput = document.getElementById(
    "tag-cloud-max-tags",
  ) as HTMLInputElement | null;
  if (maxTagsInput) {
    maxTagsInput.value = String(state.tagCloudMaxTags || 120);
    maxTagsInput.addEventListener("change", async () => {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      const val = Math.max(
        20,
        Math.min(500, parseInt(maxTagsInput.value, 10) || 120),
      );
      state.setTagCloudMaxTags(val);
      await saveSettings({ tag_cloud_max_tags: val });
      if (state.currentView === "tag-cloud") {
        const { renderTagCloud } =
          await import("@features/bookmarks/tag-cloud.ts");
        renderTagCloud();
      }
    });
  }

  // Initialize tag cloud show all toggle
  const showAllToggle = document.getElementById(
    "tag-cloud-default-show-all",
  ) as HTMLInputElement | null;
  if (showAllToggle) {
    showAllToggle.checked = !!state.tagCloudDefaultShowAll;
    showAllToggle.addEventListener("change", async () => {
      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      const val = !!showAllToggle.checked;
      state.setTagCloudDefaultShowAll(val);
      await saveSettings({ tag_cloud_default_show_all: val ? 1 : 0 });
      // Also set local preference to match default immediately
      safeLocalStorage.setItem("anchormarks_tag_cloud_show_all", String(val));
      if (state.currentView === "tag-cloud") {
        const { renderTagCloud } =
          await import("@features/bookmarks/tag-cloud.ts");
        renderTagCloud();
      }
    });
  }

  // Note: settings-tag-sort and tag-search-input listeners are already
  // initialized in initTagListeners() from tags.ts, which is called globally
}

// Attach settings modal logout button listener
function attachSettingsModalLogout(): void {
  const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
  if (logoutBtn) {
    // Remove existing listener by cloning
    logoutBtn.replaceWith(logoutBtn.cloneNode(true));
    const newLogoutBtn = document.getElementById(
      "logout-btn",
    ) as HTMLButtonElement;

    if (newLogoutBtn) {
      newLogoutBtn.addEventListener("click", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const { logout } = await import("@features/auth/auth.ts");
        logout();
      });
    }
  }
}

// Close all modals
export function closeModals(): void {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.add("hidden");

    // Remove focus trap when closing modal
    if (modal.id) {
      removeFocusTrap(modal.id);
    }

    // Remove ARIA attributes
    modal.removeAttribute("role");
    modal.removeAttribute("aria-modal");
    modal.removeAttribute("aria-labelledby");
  });
  resetForms();

  // Clear import progress if settings modal was open
  const importProgress = document.getElementById("import-html-progress");
  if (importProgress) {
    importProgress.innerHTML = "";
  }
  const importBtn = document.getElementById(
    "import-html-btn",
  ) as HTMLButtonElement;
  if (importBtn) {
    importBtn.disabled = false;
    importBtn.removeAttribute("aria-busy");
  }
}

// Reset forms
export async function resetForms(): Promise<void> {
  const bookmarkForm = document.getElementById(
    "bookmark-form",
  ) as HTMLFormElement;
  const folderForm = document.getElementById("folder-form") as HTMLFormElement;

  if (bookmarkForm) bookmarkForm.reset();
  if (folderForm) folderForm.reset();

  const bookmarkId = document.getElementById("bookmark-id") as HTMLInputElement;
  const folderId = document.getElementById("folder-id") as HTMLInputElement;
  if (bookmarkId) bookmarkId.value = "";
  if (folderId) folderId.value = "";

  const bookmarkModalTitle = document.getElementById("bookmark-modal-title");
  const folderModalTitle = document.getElementById("folder-modal-title");
  if (bookmarkModalTitle) bookmarkModalTitle.textContent = "Add Bookmark";
  if (folderModalTitle) folderModalTitle.textContent = "New Folder";

  // Reset folder color picker
  document.querySelectorAll(".color-option").forEach((opt, i) => {
    opt.classList.toggle("active", i === 0);
  });

  const folderColor = document.getElementById(
    "folder-color",
  ) as HTMLInputElement;
  if (folderColor) folderColor.value = "#6366f1";

  // Reset bookmark color picker
  document.querySelectorAll(".color-option-bookmark").forEach((opt, i) => {
    opt.classList.toggle("active", i === 0);
  });

  const bookmarkColor = document.getElementById(
    "bookmark-color",
  ) as HTMLInputElement;
  if (bookmarkColor) bookmarkColor.value = "";

  if (dom.tagSuggestions) dom.tagSuggestions.innerHTML = "";

  // Clear the badge-based tag input
  try {
    const { clearTags } = await import("@features/bookmarks/tag-input.ts");
    clearTags();
  } catch {
    // Tag input module may not be available
  }
}

// Add tag to input field
export function addTagToInput(tag: string): void {
  if (!dom.bookmarkTagsInput) return;
  const current = new Set(parseTagInput(dom.bookmarkTagsInput.value));
  current.add(tag);
  dom.bookmarkTagsInput.value = Array.from(current).join(", ");
}
// Update active navigation
export function updateActiveNav(): void {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });

  if (state.currentView === "folder") {
    document
      .querySelector(`.folder-item[data-folder="${state.currentFolder}"]`)
      ?.classList.add("active");
  } else if (state.currentView === "dashboard") {
    document
      .querySelector(`.nav-item[data-view="dashboard"]`)
      ?.classList.add("active");
  } else if (state.currentView === "collection") {
    // Collections are a bookmarks sub-view; keep the Bookmarks nav highlighted
    document
      .querySelector(`.nav-item[data-view="all"]`)
      ?.classList.add("active");
  } else {
    document
      .querySelector(`.nav-item[data-view="${state.currentView}"]`)
      ?.classList.add("active");
  }

  // Toggle sidebar sections visibility based on view
  // Only hide Filters section in Dashboard (keep Folders/Tags for drag & drop)
  const sectionsToToggle = ["filters-section"];
  const isDashboard = state.currentView === "dashboard";

  sectionsToToggle.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (isDashboard) el.classList.add("hidden");
      else el.classList.remove("hidden");
    }
  });
}

// Update counts display
export async function updateCounts(): Promise<void> {
  try {
    // Fetch counts from server to avoid issues with filtered state.bookmarks
    const counts = await api<any>("/bookmarks/counts");

    // Validate API response
    if (!counts || typeof counts !== "object") {
      logger.warn("Invalid counts response from server", counts);
      // Don't return early - still try to show badges with default values
    }

    // Ensure all expected count properties exist with defaults
    // Convert to numbers in case API returns strings (defensive programming)
    const safeCounts = {
      all: Number(counts?.all) || 0,
      favorites: Number(counts?.favorites) || 0,
      recent: Number(counts?.recent) || 0,
      archived: Number(counts?.archived) || 0,
      most_used: Number(counts?.most_used) || 0,
    };

    // Elements
    const bookmarkCountEl = document.getElementById("bookmark-count");
    const favCountEl = document.getElementById("fav-count");
    const recentCountEl = document.getElementById("count-recent");
    const archivedCountEl = document.getElementById("count-archived");
    const mostUsedCountEl = document.getElementById("count-most-used");

    // Helper function to update badge with count
    const updateBadge = (el: HTMLElement | null, count: number): void => {
      if (!el) {
        logger.warn("Badge element not found");
        return;
      }
      // Always show the badge with the count
      el.textContent = count.toString();
      // Ensure badge is visible by removing any inline styles that might hide it
      el.style.removeProperty("display");
      el.style.removeProperty("visibility");
      el.style.removeProperty("opacity");
      el.classList.remove("badge-empty");
    };

    // Update sidebar counts from server - always show all badges
    updateBadge(bookmarkCountEl, safeCounts.all);
    updateBadge(favCountEl, safeCounts.favorites);
    updateBadge(recentCountEl, safeCounts.recent);
    updateBadge(archivedCountEl, safeCounts.archived);
    updateBadge(mostUsedCountEl, safeCounts.most_used);

    // Calculate dashboard count from widgets
    // Always calculate dashboard count regardless of current view
    let dashboardVal = 0;

    // Ensure state.dashboardWidgets and state.bookmarks are available
    if (
      Array.isArray(state.dashboardWidgets) &&
      Array.isArray(state.bookmarks) &&
      state.dashboardWidgets.length > 0
    ) {
      const displayedIds = new Set();
      state.dashboardWidgets.forEach((w) => {
        if (w.type === "folder") {
          state.bookmarks
            .filter((b) => b.folder_id === w.id && !b.is_archived)
            .forEach((b) => displayedIds.add(b.id));
        } else if (w.type === "tag") {
          state.bookmarks
            .filter(
              (b) =>
                !b.is_archived &&
                b.tags &&
                b.tags
                  .split(",")
                  .map((t) => t.trim())
                  .includes(w.id),
            )
            .forEach((b) => displayedIds.add(b.id));
        }
      });
      dashboardVal = displayedIds.size;
    }

    // Dashboard badge removed as requested

    // Update View Count Label on specific headers
    const bookmarksViewCount = document.getElementById("bookmarks-view-count");
    const favoritesViewCount = document.getElementById("favorites-view-count");
    const recentsViewCount = document.getElementById("recents-view-count");
    const archivedViewCount = document.getElementById("archived-view-count");

    let currentViewCount = state.renderedBookmarks.length;
    if (state.currentView === "dashboard") currentViewCount = dashboardVal;

    // Update the appropriate view-specific count
    switch (state.currentView) {
      case "all":
      case "folder":
      case "collection":
        if (bookmarksViewCount) {
          bookmarksViewCount.textContent = `${currentViewCount} bookmark${currentViewCount !== 1 ? "s" : ""}`;
        }
        break;
      case "favorites":
        if (favoritesViewCount) {
          favoritesViewCount.textContent = `${safeCounts.favorites} favorite${safeCounts.favorites !== 1 ? "s" : ""}`;
        }
        break;
      case "recent":
        if (recentsViewCount) {
          recentsViewCount.textContent = `${safeCounts.recent} recent`;
        }
        break;
      case "archived":
        if (archivedViewCount) {
          archivedViewCount.textContent = `${safeCounts.archived} archived`;
        }
        break;
      case "most-used": {
        const mostUsedViewCount = document.getElementById(
          "most-used-view-count",
        );
        if (mostUsedViewCount) {
          mostUsedViewCount.textContent = `${currentViewCount} link${currentViewCount !== 1 ? "s" : ""}`;
        }
        break;
      }
    }

    updateStats();
  } catch (err) {
    logger.error("Error updating counts", err);
    // On error, try to at least show that counts couldn't be loaded
    // Don't hide badges - let them show their last known value or "0"
    const badgeIds = [
      "bookmark-count",
      "fav-count",
      "count-recent",
      "dashboard-count",
      "count-archived",
      "count-most-used",
    ];
    badgeIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        // Ensure badge is visible even on error
        el.style.removeProperty("display");
        el.style.removeProperty("visibility");
        el.style.removeProperty("opacity");
      }
    });
  }
}

// Update stats
export function updateStats(): void {
  const statBookmarks = document.getElementById("stat-bookmarks");
  const statFolders = document.getElementById("stat-folders");
  const statTags = document.getElementById("stat-tags");
  const foldersCount = document.getElementById("folders-count");

  // Use totalCount which reflects all matching bookmarks (not just what's loaded)
  let bCount = state.totalCount;
  let fCount = state.folders.length;
  let tCount = 0;

  // Calculate tag count for current view
  const tagSet = new Set();
  state.renderedBookmarks.forEach((b) => {
    if (b.tags) {
      b.tags.split(",").forEach((t) => {
        const tag = t.trim();
        if (tag) tagSet.add(tag);
      });
    }
  });
  tCount = tagSet.size;

  // Override for dashboard view
  if (state.currentView === "dashboard") {
    fCount = state.dashboardWidgets.filter((w) => w.type === "folder").length;
    tCount = state.dashboardWidgets.filter((w) => w.type === "tag").length;

    const displayedIds = new Set();
    state.dashboardWidgets.forEach((w) => {
      if (w.type === "folder") {
        state.bookmarks
          .filter((b) => b.folder_id === w.id)
          .forEach((b) => displayedIds.add(b.id));
      } else if (w.type === "tag") {
        state.bookmarks
          .filter(
            (b) =>
              b.tags &&
              b.tags
                .split(",")
                .map((t) => t.trim())
                .includes(w.id),
          )
          .forEach((b) => displayedIds.add(b.id));
      }
    });
    bCount = displayedIds.size;
  }

  if (statBookmarks) statBookmarks.textContent = bCount.toString();
  if (statFolders) statFolders.textContent = fCount.toString();
  if (statTags) statTags.textContent = tCount.toString();

  // Sidebar stat labels: pluralize (e.g. "1 link" vs "4 links")
  const labelLinks = document.getElementById("stat-label-links");
  const labelFolders = document.getElementById("stat-label-folders");
  const labelTags = document.getElementById("stat-label-tags");
  if (labelLinks) labelLinks.textContent = pluralize(bCount, "link", "links");
  if (labelFolders)
    labelFolders.textContent = pluralize(fCount, "folder", "folders");
  if (labelTags) labelTags.textContent = pluralize(tCount, "tag", "tags");

  // Sidebar badge always shows total folders
  if (foldersCount) foldersCount.textContent = state.folders.length.toString();
}

// Get contextual empty state message
export function getEmptyStateMessage(): string {
  if (state.currentView === "favorites") {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--primary-400);margin-bottom:1rem">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <h3>You haven't added any favorites yet</h3>
                <p>Click the star icon <span style="color:var(--primary-400)">⭐</span> on any bookmark<br>to mark it as favorite.</p>
            </div>
        `;
  }

  if (state.currentView === "archived") {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <h3>No archived bookmarks</h3>
                <p>Archived bookmarks are hidden from your main view.<br>Use the archive action on any bookmark to add it here.</p>
            </div>
        `;
  }

  if (state.currentView === "recent") {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <h3>No recent bookmarks</h3>
                <p>Recently clicked bookmarks will appear here.<br>Start browsing your bookmarks to see them here!</p>
            </div>
        `;
  }

  if (state.currentView === "most-used") {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <h3>No visits yet</h3>
                <p>Links you click will appear here, ranked by how often you visit them.</p>
            </div>
        `;
  }

  if (state.filterConfig.tags.length > 0) {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                <h3>No bookmarks with these tags</h3>
                <p>No bookmarks match your selected tags.<br><button class="btn-link" data-action="clear-filters">Clear filters</button></p>
            </div>
        `;
  }

  const searchValue = dom.searchInput?.value.trim();
  if (searchValue) {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                </svg>
                <h3>No results found</h3>
                <p>No bookmarks match "${escapeHtml(searchValue)}".<br>Try a different search term.</p>
            </div>
        `;
  }

  if (state.currentView === "folder" && state.currentFolder) {
    return `
            <div class="empty-state-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--text-tertiary);margin-bottom:1rem">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <h3>This folder is empty</h3>
                <p>Add bookmarks to this folder by clicking<br>"Add Bookmark" and selecting it.</p>
            </div>
        `;
  }

  return `
        <div class="empty-state-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;color:var(--primary-400);margin-bottom:1rem">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            <h3>No bookmarks yet</h3>
            <p>Click "Add Bookmark" to save your first link,<br>or import bookmarks from your browser.</p>
            <button class="btn btn-primary" data-action="open-modal" data-modal-target="bookmark-modal" style="margin-top:1rem">Add Your First Bookmark</button>
        </div>
    `;
}

// Update bulk selection UI
export function updateBulkUI(): void {
  const selectionMode = state.selectedBookmarks.size > 0;
  const headers = document.querySelectorAll(".content-header");

  headers.forEach((header) => {
    header.classList.toggle("selection-mode", selectionMode);
  });

  if (selectionMode) {
    const counts = document.querySelectorAll(".header-selection-count");
    counts.forEach((count) => {
      count.textContent = `${state.selectedBookmarks.size} selected`;
    });
  }

}

export default {
  dom,
  initDom,
  showToast,
  openModal,
  closeModals,
  resetForms,
  addTagToInput,
  updateActiveNav,
  updateCounts,
  updateStats,
  getEmptyStateMessage,
  updateBulkUI,
};
