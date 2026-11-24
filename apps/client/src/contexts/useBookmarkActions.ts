import { useCallback } from "react";
import { useBookmarks } from "./BookmarksContext";
import { useModal } from "./ModalContext";
import { showConfirm } from "./ConfirmContext";
import { showToast } from "./ToastContext";
import { api } from "@services/api.ts";
import * as legacyState from "@features/state.ts";
import type { Bookmark, ReadingState } from "../types/index";

export function useBookmarkActions() {
  const { bookmarks, setBookmarks, clearViewCache, loadBookmarks } =
    useBookmarks();
  const { openBookmarkModal, closeModal } = useModal();

  const archiveBookmark = useCallback(
    async (id: string) => {
      try {
        await api(`/bookmarks/${id}/archive`, { method: "POST" });
        setBookmarks(
          bookmarks.map((b) => (b.id === id ? { ...b, is_archived: 1 } : b)),
        );
        clearViewCache();
        showToast("Bookmark archived", "success");
      } catch (err) {
        showToast("Failed to archive bookmark", "error");
      }
    },
    [bookmarks, setBookmarks, clearViewCache],
  );

  const unarchiveBookmark = useCallback(
    async (id: string) => {
      try {
        await api(`/bookmarks/${id}/unarchive`, { method: "POST" });
        setBookmarks(
          bookmarks.map((b) => (b.id === id ? { ...b, is_archived: 0 } : b)),
        );
        clearViewCache();
        showToast("Bookmark unarchived", "success");
      } catch (err) {
        showToast("Failed to unarchive bookmark", "error");
      }
    },
    [bookmarks, setBookmarks, clearViewCache],
  );

  const deleteBookmark = useCallback(
    async (id: string) => {
      if (
        !(await showConfirm("Delete this bookmark?", {
          title: "Delete Bookmark",
          destructive: true,
        }))
      )
        return;

      try {
        await api(`/bookmarks/${id}`, { method: "DELETE" });
        setBookmarks(bookmarks.filter((b) => b.id !== id));
        clearViewCache();
        showToast("Bookmark deleted", "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks, clearViewCache],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (!bookmark) return;

      const newValue = bookmark.is_favorite ? 0 : 1;
      try {
        await api(`/bookmarks/${id}`, {
          method: "PUT",
          body: JSON.stringify({ is_favorite: newValue }),
        });
        setBookmarks(
          bookmarks.map((b) =>
            b.id === id ? { ...b, is_favorite: Boolean(newValue) } : b,
          ),
        );
        clearViewCache();
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks, clearViewCache],
  );

  const editBookmark = useCallback(
    (id: string) => {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (!bookmark) return;
      openBookmarkModal({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description || "",
        tags: (bookmark.tags as string) || "",
        note: (bookmark as any).note || "",
        folderId: bookmark.folder_id || null,
        color: bookmark.color || "",
        og_image: bookmark.og_image || undefined,
        readingState: bookmark.reading_state || "unread",
      });
    },
    [bookmarks, openBookmarkModal],
  );

  const setReadingState = useCallback(
    async (
      id: string,
      readingState: ReadingState,
      options: { archive?: boolean } = {},
    ) => {
      try {
        await api(`/bookmarks/${id}/reading-state`, {
          method: "POST",
          body: JSON.stringify({
            reading_state: readingState,
            ...(options.archive === undefined
              ? {}
              : { archive: options.archive }),
          }),
        });
        clearViewCache();
        await loadBookmarks();
        const messages: Record<ReadingState, string> = {
          unread: "Moved back to your reading queue",
          reading: "Marked as currently reading",
          done: options.archive ? "Finished and archived" : "Marked as read",
        };
        showToast(messages[readingState], "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [clearViewCache, loadBookmarks],
  );

  const checkBookmarkLink = useCallback(
    async (id: string) => {
      try {
        const response = await api<{ data: { status: string } }>(
          `/bookmarks/${id}/check-link`,
          { method: "POST" },
        );
        clearViewCache();
        await loadBookmarks();
        showToast(
          `Link status: ${response.data.status}`,
          ["ok", "redirect"].includes(response.data.status)
            ? "success"
            : "info",
        );
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [clearViewCache, loadBookmarks],
  );

  const createBookmark = useCallback(
    async (data: Partial<Bookmark>) => {
      try {
        const bookmark = await api<Bookmark>("/bookmarks", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setBookmarks([bookmark, ...bookmarks]);
        clearViewCache();
        closeModal();
        showToast("Bookmark added!", "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks, clearViewCache, closeModal],
  );

  const updateBookmark = useCallback(
    async (id: string, data: Partial<Bookmark>) => {
      try {
        const bookmark = await api<Bookmark>(`/bookmarks/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        setBookmarks(bookmarks.map((b) => (b.id === id ? bookmark : b)));
        clearViewCache();
        // Dashboard widget previews read from the legacy widget cache, so drop
        // it and re-render when editing from the dashboard.
        legacyState.clearWidgetDataCache();
        if (legacyState.currentView === "dashboard") {
          const { renderDashboard } =
            await import("@features/bookmarks/dashboard.ts");
          await renderDashboard();
        }
        closeModal();
        showToast("Bookmark updated", "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks, clearViewCache, closeModal],
  );

  return {
    archiveBookmark,
    unarchiveBookmark,
    deleteBookmark,
    toggleFavorite,
    editBookmark,
    createBookmark,
    updateBookmark,
    setReadingState,
    checkBookmarkLink,
  };
}
