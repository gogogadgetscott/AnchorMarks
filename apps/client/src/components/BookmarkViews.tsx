import { useEffect, useRef, useState } from "react";
import { api } from "@services/api.ts";
import { Icon } from "./Icon.tsx";
import { useToast } from "@contexts/ToastContext";

import type { BookmarkViewResponse } from "@/types/api";

export function BookmarkViews() {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<BookmarkViewResponse[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      if (!container.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

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
    const dropdownWidth = 280;

    if (!btn) {
      return {
        position: "absolute" as const,
        top: 48,
        right: 8,
        width: dropdownWidth,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        zIndex: 1400,
        padding: "0.5rem",
        display: "block",
      };
    }

    const rect = btn.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(window.innerWidth - dropdownWidth - 8, rect.left),
    );

    return {
      position: "fixed" as const,
      top: rect.bottom + 8,
      left,
      width: dropdownWidth,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border-color)",
      borderRadius: 6,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      zIndex: 1400,
      padding: "0.5rem",
      display: "block",
    };
  }

  return (
    <div
      ref={containerRef}
      className="bookmark-views-container"
      style={{ position: "relative" }}
    >
      <button
        id="bookmark-views-btn"
        ref={btnRef}
        className="btn btn-secondary"
        onClick={(e) => {
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            fetchAndOpen();
          }
        }}
        title="Views"
        aria-haspopup="true"
      >
        <Icon name="link" size={16} /> Views
      </button>

      {open && (
        <div
          className="bookmark-views-dropdown"
          style={dropdownStyle()}
          role="dialog"
        >
          <div
            style={{
              padding: "0.5rem",
              fontWeight: 600,
              borderBottom: "1px solid var(--border-color)",
              color: "var(--text-primary)",
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
                    style={{
                      textAlign: "left",
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                    }}
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
