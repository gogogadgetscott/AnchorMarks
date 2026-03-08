import React, { useEffect, useRef, useState } from "react";
import { api } from "@services/api.ts";
import { Icon } from "./Icon.tsx";
import { useToast } from "@contexts/ToastContext";

import type { BookmarkViewResponse } from "@/types/api";

export function BookmarkViews() {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<BookmarkViewResponse[]>([]);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    function onOpen(e: any) {
      const incoming = e?.detail?.views ?? [];
      setViews(Array.isArray(incoming) ? incoming : []);
      setOpen(true);
    }

    function onClose() {
      setOpen(false);
    }

    async function onSaved() {
      // refresh list
      try {
        const data = await api<BookmarkViewResponse[]>("/bookmark/views");
        setViews(Array.isArray(data) ? data : []);
      } catch (err) {
        showToast("Failed to refresh views", "error");
      }
    }

    window.addEventListener("bookmark-views:open", onOpen as EventListener);
    window.addEventListener("bookmark-views:close", onClose as EventListener);
    window.addEventListener("bookmark-views:saved", onSaved as EventListener);
    window.addEventListener("bookmark-views:deleted", onSaved as EventListener);

    return () => {
      window.removeEventListener(
        "bookmark-views:open",
        onOpen as EventListener,
      );
      window.removeEventListener(
        "bookmark-views:close",
        onClose as EventListener,
      );
      window.removeEventListener(
        "bookmark-views:saved",
        onSaved as EventListener,
      );
      window.removeEventListener(
        "bookmark-views:deleted",
        onSaved as EventListener,
      );
    };
  }, [showToast]);

  async function fetchAndOpen() {
    try {
      const data = await api<BookmarkViewResponse[]>("/bookmark/views");
      setViews(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch (err) {
      showToast("Failed to load views", "error");
    }
  }

  async function handleRestore(id: string) {
    try {
      // Delegate to legacy module which knows how to apply the view
      const mod = await import("@features/bookmarks/bookmarks.ts");
      await mod.restoreBookmarkView(id);
      setOpen(false);
    } catch (err) {
      showToast("Failed to restore view", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api(`/bookmark/views/${id}`, { method: "DELETE" });
      setViews((prev) => prev.filter((v) => v.id !== id));
      window.dispatchEvent(
        new CustomEvent("bookmark-views:deleted", { detail: { id } }),
      );
      showToast("View deleted", "success");
    } catch (err) {
      showToast("Failed to delete view", "error");
    }
  }

  function dropdownStyle() {
    const btn = btnRef.current;
    if (!btn)
      return { position: "absolute", top: 48, right: 8 } as React.CSSProperties;
    const rect = btn.getBoundingClientRect();
    return {
      position: "fixed",
      top: rect.bottom + 8,
      left: Math.max(8, rect.left + rect.width / 2 - 140),
      minWidth: 280,
      zIndex: 1200,
    } as React.CSSProperties;
  }

  return (
    <div className="bookmark-views-container" style={{ position: "relative" }}>
      <button
        id="views-btn"
        ref={btnRef}
        className="btn btn-secondary"
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else fetchAndOpen();
        }}
        title="Views"
        aria-haspopup="true"
      >
        <Icon name="bookmark" size={16} /> Views
      </button>

      {open && (
        <div className="dropdown-menu" style={dropdownStyle()} role="dialog">
          <div
            style={{
              padding: "0.5rem",
              fontWeight: 600,
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            Bookmark Views
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {views.length === 0 ? (
              <div
                style={{
                  padding: "0.5rem",
                  color: "var(--text-tertiary)",
                  textAlign: "center",
                }}
              >
                No saved views
              </div>
            ) : (
              views.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.4rem 0.5rem",
                  }}
                >
                  <button
                    className="link-like"
                    onClick={() => handleRestore(v.id)}
                    style={{ textAlign: "left", flex: 1 }}
                  >
                    {v.name}
                  </button>
                  <button
                    className="btn-icon small text-danger"
                    title="Delete"
                    onClick={() => handleDelete(v.id)}
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border-color)",
              padding: "0.5rem",
            }}
          >
            <button
              className="btn btn-primary btn-sm btn-full"
              onClick={async () => {
                const mod = await import("@features/bookmarks/bookmarks.ts");
                await mod.saveCurrentBookmarkView();
              }}
            >
              <Icon name="save" size={12} /> Save Current View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookmarkViews;
