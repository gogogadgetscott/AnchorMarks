/**
 * AnchorMarks - Tags UI Module
 * Handles tag editor, renaming, and sidebar tag search
 */

import * as state from "@features/state.ts";
import { showToast } from "@utils/ui-helpers.ts";
import { confirmDialog } from "@features/ui/confirm-dialog.ts";

/**
 * Initialize tag-related listeners
 */
export function initTagListeners(): void {
  // Tag Editor Form
  document.getElementById("tag-form")?.addEventListener("submit", (e) => {
    import("@features/bookmarks/search.ts").then(({ handleTagSubmit }) =>
      handleTagSubmit(e),
    );
  });

  // Tag color options
  document.querySelectorAll(".color-option-tag").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".color-option-tag")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tagColorInput = document.getElementById(
        "tag-color",
      ) as HTMLInputElement;
      if (tagColorInput)
        tagColorInput.value = (btn as HTMLElement).dataset.color || "#f59e0b";
    });
  });

  // Tag Sort in Settings
  document
    .getElementById("settings-tag-sort")
    ?.addEventListener("change", (e) => {
      const value = (e.target as HTMLSelectElement).value;
      state.filterConfig.tagSort = value;

      // Update the filter dropdown if it exists
      const filterTagSort = document.getElementById("filter-tag-sort");
      if (filterTagSort) (filterTagSort as HTMLSelectElement).value = value;

      // Save and re-render
      import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
        saveSettings({ tag_sort: value }),
      );
      import("@features/bookmarks/search.ts").then(
        ({ renderSidebarTags, loadTagStats }) => {
          renderSidebarTags();
          loadTagStats();
        },
      );
    });

  // Tag Search in Settings
  document
    .getElementById("tag-search-input")
    ?.addEventListener("input", (e) => {
      import("@features/bookmarks/search.ts").then(({ filterTagStats }) =>
        filterTagStats((e.target as HTMLInputElement).value),
      );
    });

  // Tag rename
  document
    .getElementById("tag-rename-btn")
    ?.addEventListener("click", async () => {
      const fromInput = document.getElementById(
        "tag-rename-from",
      ) as HTMLInputElement;
      const toInput = document.getElementById(
        "tag-rename-to",
      ) as HTMLInputElement;
      const from = fromInput?.value.trim();
      const to = toInput?.value.trim();

      if (!from || !to) {
        showToast("Enter both tags to rename", "error");
        return;
      }
      if (
        !(await confirmDialog(`Rename tag "${from}" to "${to}"?`, {
          title: "Rename Tag",
        }))
      )
        return;

      try {
        const { renameTagAcross } =
          await import("@features/bookmarks/search.ts");
        await renameTagAcross(from, to);
      } catch (err: any) {
        showToast(err.message || "Rename failed", "error");
      }
    });

  // Undo tag rename
  document
    .getElementById("tag-rename-undo-btn")
    ?.addEventListener("click", async () => {
      if (!state.lastTagRenameAction) return;
      const { from, to } = state.lastTagRenameAction;
      if (
        !(await confirmDialog(`Undo rename ${from} → ${to}?`, {
          title: "Undo Rename",
        }))
      )
        return;

      try {
        const searchModule = await import("@features/bookmarks/search.ts");
        await searchModule.renameTagAcross(to, from);
        state.setLastTagRenameAction(null);
        searchModule.updateTagRenameUndoButton();
        showToast("Undo complete", "success");
      } catch (err: any) {
        showToast(err.message || "Undo failed", "error");
      }
    });

  // Add new tag
  document
    .getElementById("add-new-tag-btn")
    ?.addEventListener("click", async () => {
      const nameInput = document.getElementById(
        "new-tag-name",
      ) as HTMLInputElement;
      const colorInput = document.getElementById(
        "new-tag-color",
      ) as HTMLInputElement;
      const name = nameInput?.value.trim();
      const color = colorInput?.value || "#f59e0b";

      if (!name) {
        showToast("Please enter a tag name", "error");
        nameInput?.focus();
        return;
      }

      const { createNewTag } = await import("@features/bookmarks/search.ts");
      const success = await createNewTag(name, color);
      if (success) {
        if (nameInput) nameInput.value = "";
        if (colorInput) colorInput.value = "#f59e0b";
        nameInput?.focus();
      }
    });

  // Enter key support for new tag
  document
    .getElementById("new-tag-name")
    ?.addEventListener("keypress", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("add-new-tag-btn")?.click();
      }
    });

  // Sidebar tag search
  document
    .getElementById("sidebar-tag-search")
    ?.addEventListener("input", (e: Event) => {
      import("@features/bookmarks/search.ts").then(({ filterSidebarTags }) =>
        filterSidebarTags((e.target as HTMLInputElement).value),
      );
    });

  // Show more tags
  document.getElementById("tags-show-more")?.addEventListener("click", () => {
    import("@features/bookmarks/search.ts").then(({ showAllTags }) =>
      showAllTags(),
    );
  });
}
