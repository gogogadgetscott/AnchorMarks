/**
 * AnchorMarks - Bulk Operations Module
 * Handles bulk actions on bookmarks
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { parseTagInput } from "@utils/index.ts";
import { showToast, updateCounts } from "@utils/ui-helpers.ts";

// Bulk delete
export async function bulkDelete(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;
  if (!confirm(`Delete ${state.selectedBookmarks.size} bookmark(s)?`)) return;

  const ids = Array.from(state.selectedBookmarks);
  for (const id of ids) {
    await api(`/bookmarks/${id}`, { method: "DELETE" });
  }

  state.setBookmarks(
    state.bookmarks.filter((b) => !state.selectedBookmarks.has(b.id)),
  );
  const { clearSelections } = await import("@features/bookmarks/bookmarks.ts");
  clearSelections();
  await updateCounts();
  showToast("Bookmarks deleted", "success");
}

// Bulk favorite
export async function bulkFavorite(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;

  const ids = Array.from(state.selectedBookmarks);
  for (const id of ids) {
    await api(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite: 1 }),
    });
    const bm = state.bookmarks.find((b) => b.id === id);
    if (bm) bm.is_favorite = true;
  }

  const { renderBookmarks } = await import("@features/bookmarks/bookmarks.ts");
  renderBookmarks();
  await updateCounts();
  showToast("Marked as favorite", "success");
}

// Bulk move
export async function bulkMove(): Promise<void> {
  const select = document.getElementById(
    "bulk-move-select",
  ) as HTMLSelectElement;
  if (!select) return;

  const folderId = select.value || null;
  if (folderId === null) return;

  const ids = Array.from(state.selectedBookmarks);
  for (const id of ids) {
    await api(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ folder_id: folderId }),
    });
    const bm = state.bookmarks.find((b) => b.id === id);
    if (bm) bm.folder_id = folderId;
  }

  const { clearSelections } = await import("@features/bookmarks/bookmarks.ts");
  clearSelections();
  await updateCounts();
  showToast("Bookmarks moved", "success");
}

// Bulk add tags
export async function bulkAddTags(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;

  const raw = prompt("Add tags (comma separated):");
  const tagsToAdd = parseTagInput(raw || "");
  if (tagsToAdd.length === 0) return;

  const ids = Array.from(state.selectedBookmarks);
  await api("/tags/bulk-add", {
    method: "POST",
    body: JSON.stringify({ bookmark_ids: ids, tags: tagsToAdd }),
  });

  state.setBookmarks(
    state.bookmarks.map((b) => {
      if (!state.selectedBookmarks.has(b.id)) return b;
      const merged = new Set([...parseTagInput(b.tags || ""), ...tagsToAdd]);
      return {
        ...b,
        tags: Array.from(merged).join(", "),
        tags_detailed: undefined,
      };
    }),
  );

  const { clearSelections, renderBookmarks } =
    await import("@features/bookmarks/bookmarks.ts");
  const { renderSidebarTags } = await import("@features/bookmarks/search.ts");
  clearSelections();
  await updateCounts();
  renderBookmarks();
  renderSidebarTags();
  showToast("Tags added to selection", "success");
}

// Bulk remove tags
export async function bulkRemoveTags(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;

  const raw = prompt("Remove tags (comma separated):");
  const tagsToRemove = parseTagInput(raw || "");
  if (tagsToRemove.length === 0) return;

  const ids = Array.from(state.selectedBookmarks);
  await api("/tags/bulk-remove", {
    method: "POST",
    body: JSON.stringify({ bookmark_ids: ids, tags: tagsToRemove }),
  });

  const removeSet = new Set(tagsToRemove.map((t) => t.toLowerCase()));
  state.setBookmarks(
    state.bookmarks.map((b) => {
      if (!state.selectedBookmarks.has(b.id) || !b.tags) return b;
      const filtered = parseTagInput(b.tags).filter(
        (t) => !removeSet.has(t.toLowerCase()),
      );
      return {
        ...b,
        tags: filtered.join(", "),
        tags_detailed: undefined,
      };
    }),
  );

  const { clearSelections, renderBookmarks } =
    await import("@features/bookmarks/bookmarks.ts");
  const { renderSidebarTags } = await import("@features/bookmarks/search.ts");
  clearSelections();
  await updateCounts();
  renderBookmarks();
  renderSidebarTags();
  showToast("Tags removed from selection", "success");
}

// Bulk archive
export async function bulkArchive(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;

  const ids = Array.from(state.selectedBookmarks);

  try {
    await api("/bookmarks/bulk/archive", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  } catch (err) {
    console.error("[bulkArchive] API call failed:", err);
    showToast("Failed to archive bookmarks", "error");
    return;
  }

  state.setBookmarks(
    state.bookmarks.map((b) => {
      if (!state.selectedBookmarks.has(b.id)) return b;
      return { ...b, is_archived: 1 };
    }),
  );

  const { clearSelections, renderBookmarks } =
    await import("@features/bookmarks/bookmarks.ts");
  clearSelections();
  renderBookmarks();
  await updateCounts();
  showToast(`${ids.length} bookmarks archived`, "success");
}

// Bulk unarchive
export async function bulkUnarchive(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;

  const ids = Array.from(state.selectedBookmarks);
  await api("/bookmarks/bulk/unarchive", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

  state.setBookmarks(
    state.bookmarks.map((b) => {
      if (!state.selectedBookmarks.has(b.id)) return b;
      return { ...b, is_archived: 0 };
    }),
  );

  const { clearSelections, renderBookmarks } =
    await import("@features/bookmarks/bookmarks.ts");
  clearSelections();
  renderBookmarks();
  await updateCounts();
  showToast(`${ids.length} bookmarks unarchived`, "success");
}

export default {
  bulkAddTags,
  bulkRemoveTags,
  bulkArchive,
  bulkUnarchive,
};
