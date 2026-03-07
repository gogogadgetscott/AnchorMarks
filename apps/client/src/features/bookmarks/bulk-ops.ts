/**
 * AnchorMarks - Bulk Operations Module
 * Handles bulk actions on bookmarks
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { parseTagInput } from "@utils/index.ts";
import { showToast, updateCounts } from "@utils/ui-helpers.ts";
import { confirmDialog, tagPickerDialog } from "@features/ui/confirm-dialog.ts";

// Bulk delete
export async function bulkDelete(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;
  if (state.selectedBookmarks.size === 0) return;
  if (
    !(await confirmDialog(
      `Delete ${state.selectedBookmarks.size} bookmark(s)?`,
      {
        title: "Bulk Delete",
        destructive: true,
      },
    ))
  )
    return;

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

  const tagsToAdd = await tagPickerDialog({
    title: "Bulk Add Tags",
    confirmText: "Add Tags",
    selectionCount: state.selectedBookmarks.size,
  });
  if (!tagsToAdd || tagsToAdd.length === 0) return;

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

  const tagsToRemove = await tagPickerDialog({
    title: "Bulk Remove Tags",
    confirmText: "Remove Tags",
    selectionCount: state.selectedBookmarks.size,
  });
  if (!tagsToRemove || tagsToRemove.length === 0) return;

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

// Bulk auto-tag using smart suggestions
export async function bulkAutoTag(): Promise<void> {
  if (state.selectedBookmarks.size === 0) return;

  const ids = Array.from(state.selectedBookmarks);
  const bookmarks = state.bookmarks.filter((b) => ids.includes(b.id));

  if (
    !(await confirmDialog(
      `Auto-tag ${bookmarks.length} bookmark(s) using smart suggestions?`,
      { title: "Auto-Tag", confirmText: "Auto-Tag" },
    ))
  )
    return;

  let taggedCount = 0;

  for (const bookmark of bookmarks) {
    try {
      const [smartResponse, aiResponse] = await Promise.allSettled([
        api<{ suggestions: { tag: string }[] }>(
          `/tags/suggest-smart?url=${encodeURIComponent(bookmark.url)}&limit=6`,
        ),
        api<{ suggestions: { tag: string }[] }>(
          `/tags/suggest-ai?url=${encodeURIComponent(bookmark.url)}&limit=6`,
        ),
      ]);

      const smartTags =
        smartResponse.status === "fulfilled"
          ? (smartResponse.value.suggestions || []).map((s) => s.tag).filter(Boolean)
          : [];
      const aiTags =
        aiResponse.status === "fulfilled"
          ? (aiResponse.value.suggestions || []).map((s) => s.tag).filter(Boolean)
          : [];

      const tags = Array.from(new Set([...smartTags, ...aiTags]));
      if (tags.length === 0) continue;

      await api("/tags/bulk-add", {
        method: "POST",
        body: JSON.stringify({ bookmark_ids: [bookmark.id], tags: tags.join(", ") }),
      });

      const merged = new Set([...parseTagInput(bookmark.tags || ""), ...tags]);
      const bm = state.bookmarks.find((b) => b.id === bookmark.id);
      if (bm) {
        bm.tags = Array.from(merged).join(", ");
        (bm as any).tags_detailed = undefined;
      }
      taggedCount++;
    } catch {
      // skip bookmarks that fail
    }
  }

  const { clearSelections, renderBookmarks } =
    await import("@features/bookmarks/bookmarks.ts");
  const { renderSidebarTags } = await import("@features/bookmarks/search.ts");
  clearSelections();
  await updateCounts();
  renderBookmarks();
  renderSidebarTags();
  showToast(
    taggedCount > 0
      ? `Auto-tagged ${taggedCount} bookmark(s)`
      : "No suggestions found for selected bookmarks",
    taggedCount > 0 ? "success" : "info",
  );
}

export default {
  bulkAddTags,
  bulkRemoveTags,
  bulkArchive,
  bulkUnarchive,
  bulkAutoTag,
};
