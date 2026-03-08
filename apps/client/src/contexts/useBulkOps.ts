import { useCallback } from "react";
import { useBookmarks } from "./BookmarksContext";
import { showConfirm, showTagPicker } from "./ConfirmContext";
import { showToast } from "./ToastContext";
import { api } from "@services/api.ts";
import { parseTagInput } from "@utils/index.ts";

export function useBulkOps() {
  const { selectedBookmarks, bookmarks, setBookmarks, setSelectedBookmarks, setBulkMode } =
    useBookmarks();

  const clearSelections = useCallback(() => {
    setSelectedBookmarks(new Set());
    setBulkMode(false);
  }, [setSelectedBookmarks, setBulkMode]);

  const bulkDelete = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;
    if (
      !(await showConfirm(`Delete ${selectedBookmarks.size} bookmark(s)?`, {
        title: "Bulk Delete",
        destructive: true,
      }))
    )
      return;

    const ids = Array.from(selectedBookmarks);
    for (const id of ids) {
      await api(`/bookmarks/${id}`, { method: "DELETE" });
    }

    setBookmarks(bookmarks.filter((b) => !selectedBookmarks.has(b.id)));
    clearSelections();
    showToast("Bookmarks deleted", "success");
  }, [selectedBookmarks, bookmarks, setBookmarks, clearSelections]);

  const bulkFavorite = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;

    const ids = Array.from(selectedBookmarks);
    for (const id of ids) {
      await api(`/bookmarks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ is_favorite: 1 }),
      });
    }

    setBookmarks(
      bookmarks.map((b) =>
        selectedBookmarks.has(b.id) ? { ...b, is_favorite: true } : b,
      ),
    );
    showToast("Marked as favorite", "success");
  }, [selectedBookmarks, bookmarks, setBookmarks]);

  const bulkMove = useCallback(
    async (folderId: string) => {
      if (!folderId || selectedBookmarks.size === 0) return;

      const ids = Array.from(selectedBookmarks);
      for (const id of ids) {
        await api(`/bookmarks/${id}`, {
          method: "PUT",
          body: JSON.stringify({ folder_id: folderId }),
        });
      }

      setBookmarks(
        bookmarks.map((b) =>
          selectedBookmarks.has(b.id) ? { ...b, folder_id: folderId } : b,
        ),
      );
      clearSelections();
      showToast("Bookmarks moved", "success");
    },
    [selectedBookmarks, bookmarks, setBookmarks, clearSelections],
  );

  const bulkAddTags = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;

    const tagsToAdd = await showTagPicker({
      title: "Bulk Add Tags",
      confirmText: "Add Tags",
      selectionCount: selectedBookmarks.size,
    });
    if (!tagsToAdd || tagsToAdd.length === 0) return;

    const ids = Array.from(selectedBookmarks);
    await api("/tags/bulk-add", {
      method: "POST",
      body: JSON.stringify({ bookmark_ids: ids, tags: tagsToAdd }),
    });

    setBookmarks(
      bookmarks.map((b) => {
        if (!selectedBookmarks.has(b.id)) return b;
        const merged = new Set([...parseTagInput(b.tags || ""), ...tagsToAdd]);
        return { ...b, tags: Array.from(merged).join(", "), tags_detailed: undefined };
      }),
    );
    clearSelections();
    showToast("Tags added to selection", "success");
  }, [selectedBookmarks, bookmarks, setBookmarks, clearSelections]);

  const bulkRemoveTags = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;

    const tagsToRemove = await showTagPicker({
      title: "Bulk Remove Tags",
      confirmText: "Remove Tags",
      selectionCount: selectedBookmarks.size,
    });
    if (!tagsToRemove || tagsToRemove.length === 0) return;

    const ids = Array.from(selectedBookmarks);
    await api("/tags/bulk-remove", {
      method: "POST",
      body: JSON.stringify({ bookmark_ids: ids, tags: tagsToRemove }),
    });

    const removeSet = new Set(tagsToRemove.map((t) => t.toLowerCase()));
    setBookmarks(
      bookmarks.map((b) => {
        if (!selectedBookmarks.has(b.id) || !b.tags) return b;
        const filtered = parseTagInput(b.tags).filter(
          (t) => !removeSet.has(t.toLowerCase()),
        );
        return { ...b, tags: filtered.join(", "), tags_detailed: undefined };
      }),
    );
    clearSelections();
    showToast("Tags removed from selection", "success");
  }, [selectedBookmarks, bookmarks, setBookmarks, clearSelections]);

  const bulkArchive = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;

    const ids = Array.from(selectedBookmarks);
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

    setBookmarks(
      bookmarks.map((b) =>
        selectedBookmarks.has(b.id) ? { ...b, is_archived: 1 } : b,
      ),
    );
    clearSelections();
    showToast(`${ids.length} bookmarks archived`, "success");
  }, [selectedBookmarks, bookmarks, setBookmarks, clearSelections]);

  const bulkUnarchive = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;

    const ids = Array.from(selectedBookmarks);
    await api("/bookmarks/bulk/unarchive", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });

    setBookmarks(
      bookmarks.map((b) =>
        selectedBookmarks.has(b.id) ? { ...b, is_archived: 0 } : b,
      ),
    );
    clearSelections();
    showToast(`${ids.length} bookmarks unarchived`, "success");
  }, [selectedBookmarks, bookmarks, setBookmarks, clearSelections]);

  const bulkAutoTag = useCallback(async () => {
    if (selectedBookmarks.size === 0) return;

    const ids = Array.from(selectedBookmarks);
    const selected = bookmarks.filter((b) => ids.includes(b.id));

    if (
      !(await showConfirm(
        `Auto-tag ${selected.length} bookmark(s) using smart suggestions?`,
        { title: "Auto-Tag", confirmText: "Auto-Tag" },
      ))
    )
      return;

    let taggedCount = 0;
    const updatedBookmarks = [...bookmarks];

    for (const bookmark of selected) {
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

        const idx = updatedBookmarks.findIndex((b) => b.id === bookmark.id);
        if (idx !== -1) {
          const merged = new Set([...parseTagInput(bookmark.tags || ""), ...tags]);
          updatedBookmarks[idx] = {
            ...updatedBookmarks[idx],
            tags: Array.from(merged).join(", "),
            tags_detailed: undefined,
          };
        }
        taggedCount++;
      } catch {
        // skip bookmarks that fail
      }
    }

    setBookmarks(updatedBookmarks);
    clearSelections();
    showToast(
      taggedCount > 0
        ? `Auto-tagged ${taggedCount} bookmark(s)`
        : "No suggestions found for selected bookmarks",
      taggedCount > 0 ? "success" : "info",
    );
  }, [selectedBookmarks, bookmarks, setBookmarks, clearSelections]);

  return {
    bulkDelete,
    bulkFavorite,
    bulkMove,
    bulkAddTags,
    bulkRemoveTags,
    bulkArchive,
    bulkUnarchive,
    bulkAutoTag,
    clearSelections,
  };
}
