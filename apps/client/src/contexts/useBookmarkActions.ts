import { useCallback } from "react";
import { useBookmarks } from "./BookmarksContext";
import { useModal } from "./ModalContext";
import { showConfirm } from "./ConfirmContext";
import { showToast } from "./ToastContext";
import { api } from "@services/api.ts";
import type { Bookmark } from "../types/index";

export function useBookmarkActions() {
  const { bookmarks, setBookmarks } = useBookmarks();
  const { openBookmarkModal, closeModal } = useModal();

  const archiveBookmark = useCallback(
    async (id: string) => {
      try {
        await api(`/bookmarks/${id}/archive`, { method: "POST" });
        setBookmarks(
          bookmarks.map((b) => (b.id === id ? { ...b, is_archived: 1 } : b)),
        );
        showToast("Bookmark archived", "success");
      } catch (err) {
        showToast("Failed to archive bookmark", "error");
      }
    },
    [bookmarks, setBookmarks],
  );

  const unarchiveBookmark = useCallback(
    async (id: string) => {
      try {
        await api(`/bookmarks/${id}/unarchive`, { method: "POST" });
        setBookmarks(
          bookmarks.map((b) => (b.id === id ? { ...b, is_archived: 0 } : b)),
        );
        showToast("Bookmark unarchived", "success");
      } catch (err) {
        showToast("Failed to unarchive bookmark", "error");
      }
    },
    [bookmarks, setBookmarks],
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
        showToast("Bookmark deleted", "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks],
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
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks],
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
      });
    },
    [bookmarks, openBookmarkModal],
  );

  const createBookmark = useCallback(
    async (data: Partial<Bookmark>) => {
      try {
        const bookmark = await api<Bookmark>("/bookmarks", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setBookmarks([bookmark, ...bookmarks]);
        closeModal();
        showToast("Bookmark added!", "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks, closeModal],
  );

  const updateBookmark = useCallback(
    async (id: string, data: Partial<Bookmark>) => {
      try {
        const bookmark = await api<Bookmark>(`/bookmarks/${id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        setBookmarks(bookmarks.map((b) => (b.id === id ? bookmark : b)));
        closeModal();
        showToast("Bookmark updated", "success");
      } catch (err: unknown) {
        showToast((err as Error).message, "error");
      }
    },
    [bookmarks, setBookmarks, closeModal],
  );

  return {
    archiveBookmark,
    unarchiveBookmark,
    deleteBookmark,
    toggleFavorite,
    editBookmark,
    createBookmark,
    updateBookmark,
  };
}
