/**
 * AnchorMarks - Forms UI Module
 * Handles all form-related event listeners (Auth, Bookmarks, Folders)
 */

import { api } from "@services/api.ts";
import { openModal, showToast } from "@utils/ui-helpers.ts";

/**
 * Initialize all form-related listeners
 */
export function initFormListeners(): void {
  initAuthForms();
  initBookmarkForms();
  initFolderForms();
}

/**
 * Handle Login and Registration forms
 */
function initAuthForms(): void {
  // Login form
  document
    .getElementById("login-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const emailEl = document.getElementById(
        "login-email",
      ) as HTMLInputElement;
      const passwordEl = document.getElementById(
        "login-password",
      ) as HTMLInputElement;
      const email = emailEl?.value;
      const password = passwordEl?.value;

      const { login } = await import("@features/auth/auth.ts");
      if (await login(email, password)) {
        const { loadSettings } =
          await import("@features/bookmarks/settings.ts");
        await loadSettings();
        // Re-initialize app state (assuming initializeApp is globally available or we import it)
        const { initializeApp } = await import("../../App.ts");
        await initializeApp();
      }
    });

  // Register form
  document
    .getElementById("register-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const emailEl = document.getElementById(
        "register-email",
      ) as HTMLInputElement;
      const passwordEl = document.getElementById(
        "register-password",
      ) as HTMLInputElement;
      const email = emailEl?.value;
      const password = passwordEl?.value;

      const { register } = await import("@features/auth/auth.ts");
      if (await register(email, password)) {
        const { loadSettings } =
          await import("@features/bookmarks/settings.ts");
        await loadSettings();
        const { initializeApp } = await import("../../App.ts");
        await initializeApp();
      }
    });
}

/**
 * Handle Bookmark Create/Edit forms
 */
function initBookmarkForms(): void {
  // Open bookmark modal
  document
    .getElementById("sidebar-add-bookmark-btn")
    ?.addEventListener("click", () => {
      openModal("bookmark-modal");
    });

  // Fetch Metadata button
  document
    .getElementById("fetch-metadata-btn")
    ?.addEventListener("click", async () => {
      const urlInput = document.getElementById(
        "bookmark-url",
      ) as HTMLInputElement;
      const titleInput = document.getElementById(
        "bookmark-title",
      ) as HTMLInputElement;
      const descInput = document.getElementById(
        "bookmark-description",
      ) as HTMLTextAreaElement;
      const btn = document.getElementById(
        "fetch-metadata-btn",
      ) as HTMLButtonElement;

      const url = urlInput?.value;
      if (!url) {
        showToast("Please enter a URL first", "error");
        return;
      }

      try {
        btn.disabled = true;
        btn.innerHTML =
          '<svg class="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Fetching...';

        const metadata = await api<{ title?: string; description?: string }>(
          "/bookmarks/fetch-metadata",
          {
            method: "POST",
            body: JSON.stringify({ url }),
          },
        );

        if (metadata.title && titleInput) titleInput.value = metadata.title;
        if (metadata.description && descInput)
          descInput.value = metadata.description;

        showToast("Info fetched successfully", "success");
      } catch (err: any) {
        showToast("Failed to fetch info: " + err.message, "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            Fetch Info
          `;
        }
      }
    });

  // Bookmark form submission
  document
    .getElementById("bookmark-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const idEl = document.getElementById("bookmark-id") as HTMLInputElement;
      const titleEl = document.getElementById(
        "bookmark-title",
      ) as HTMLInputElement;
      const urlEl = document.getElementById("bookmark-url") as HTMLInputElement;
      const folderEl = document.getElementById(
        "bookmark-folder",
      ) as HTMLSelectElement;
      const colorEl = document.getElementById(
        "bookmark-color",
      ) as HTMLInputElement;
      const descEl = document.getElementById(
        "bookmark-description",
      ) as HTMLTextAreaElement;
      const tagsEl = document.getElementById(
        "bookmark-tags",
      ) as HTMLInputElement;

      const id = idEl?.value;
      const data = {
        title: titleEl?.value,
        url: urlEl?.value,
        folder_id: folderEl?.value || undefined,
        color: colorEl?.value,
        description: descEl?.value,
        tags: tagsEl?.value || "", // Read from hidden input populated by tag-input.ts
      };

      const bookmarksModule = await import("@features/bookmarks/bookmarks.ts");
      if (id) {
        await bookmarksModule.updateBookmark(id, data);
      } else {
        await bookmarksModule.createBookmark(data);
      }
    });

  // New Folder button inside bookmark modal
  document
    .getElementById("bookmark-new-folder-btn")
    ?.addEventListener("click", async () => {
      const { promptDialog } = await import("@features/ui/confirm-dialog.ts");
      const folderName = await promptDialog("Enter folder name:", {
        title: "New Folder",
        confirmText: "Create",
        placeholder: "Folder Name",
      });

      if (!folderName || !folderName.trim()) return;

      try {
        const { createFolder } = await import("@features/bookmarks/folders.ts");

        // Create the folder - this already updates the state and UI (sidebar + dropdowns)
        const newFolder = await createFolder(
          { name: folderName.trim(), color: "#6366f1" },
          { closeModal: false }, // Don't close any modals (we're in bookmark modal)
        );

        if (newFolder && newFolder.id) {
          // Select the newly created folder
          const folderSelect = document.getElementById(
            "bookmark-folder",
          ) as HTMLSelectElement;
          if (folderSelect) {
            folderSelect.value = newFolder.id;
          }
          showToast(`Folder "${folderName}" created!`, "success");
        }
      } catch (err: any) {
        showToast(err.message || "Failed to create folder", "error");
      }
    });

  // Bookmark color options (delegation could be used here but keeping simple for now)
  document.querySelectorAll(".color-option-bookmark").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".color-option-bookmark")
        .forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      const colorInput = document.getElementById(
        "bookmark-color",
      ) as HTMLInputElement;
      if (colorInput)
        colorInput.value = (opt as HTMLElement).dataset.color || "";
    });
  });
}

/**
 * Handle Folder Create/Edit forms
 */
function initFolderForms(): void {
  // Open new folder modal
  document
    .getElementById("sidebar-add-folder-btn")
    ?.addEventListener("click", async () => {
      const modalTitle = document.getElementById("folder-modal-title");
      if (modalTitle) modalTitle.textContent = "New Folder";
      (document.getElementById("folder-form") as HTMLFormElement).reset();

      const idInput = document.getElementById("folder-id") as HTMLInputElement;
      if (idInput) idInput.value = "";

      const colorInput = document.getElementById(
        "folder-color",
      ) as HTMLInputElement;
      if (colorInput) colorInput.value = "#6366f1";

      const form = document.getElementById("folder-form");
      if (form) {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.textContent = "Create Folder";
      }

      const { updateFolderParentSelect } =
        await import("@features/bookmarks/folders.ts");
      updateFolderParentSelect();
      openModal("folder-modal");
    });

  // Folder form submission
  document
    .getElementById("folder-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      const idEl = document.getElementById("folder-id") as HTMLInputElement;
      const nameEl = document.getElementById("folder-name") as HTMLInputElement;
      const colorEl = document.getElementById(
        "folder-color",
      ) as HTMLInputElement;
      const parentEl = document.getElementById(
        "folder-parent",
      ) as HTMLSelectElement;

      const id = idEl?.value;
      const data = {
        name: nameEl?.value,
        color: colorEl?.value,
        parent_id: parentEl?.value || undefined, // Use undefined instead of null to match Folder type
      };

      const foldersModule = await import("@features/bookmarks/folders.ts");
      if (id) {
        await foldersModule.updateFolder(id, data);
      } else {
        await foldersModule.createFolder(data);
      }
    });

  // Folder color options
  document.querySelectorAll(".color-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document
        .querySelectorAll(".color-option")
        .forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      const colorInput = document.getElementById(
        "folder-color",
      ) as HTMLInputElement;
      if (colorInput)
        colorInput.value = (opt as HTMLElement).dataset.color || "#6366f1";
    });
  });
}
