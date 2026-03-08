import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { AppShell } from "./AppShell";
import { initTagInput } from "@features/bookmarks/tag-input.ts";

// Import global setups similar to vanilla App.ts
import { initDom, updateActiveNav } from "@utils/ui-helpers.ts";
import { safeLocalStorage } from "@utils/index.ts";

export function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Basic DOM setup from vanilla entrypoint
    initDom();

    // Load theme
    const savedTheme = safeLocalStorage.getItem("anchormarks_theme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    // Initialize global listeners
    Promise.all([
      import("@features/keyboard/handler.ts"),
      import("@utils/event-cleanup.ts"),
      import("@features/auth/auth.ts").then((m) => m.checkAuth()),
    ]).then(
      ([
        { handleKeyboard },
        { registerGlobalCleanup },
        isAuthed,
      ]) => {
        const globalSignal = registerGlobalCleanup();

        document.addEventListener("keydown", handleKeyboard, {
          capture: true,
          signal: globalSignal.signal,
        });

        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            document.body.classList.remove("mobile-sidebar-open");
            import("@utils/ui-helpers.ts").then((m) => m.closeModals());
          }
        }, { signal: globalSignal.signal });

        // Global Resize listener
        window.addEventListener("resize", () => {
          if (window.innerWidth > 1024) {
            document.body.classList.remove("mobile-sidebar-open");
          }
        }, { signal: globalSignal.signal });

        // Image Load/Error Delegation
        document.addEventListener("load", (e) => {
          const target = e.target as HTMLElement;
          if (target instanceof HTMLImageElement && target.classList.contains("img-loading")) {
            target.classList.add("img-loaded");
          }
        }, { capture: true, signal: globalSignal.signal });

        const faviconRefreshQueue: Array<{ id: string; target: HTMLImageElement }> = [];
        let faviconRefreshRunning = false;

        const processFaviconQueue = async () => {
          if (faviconRefreshRunning || faviconRefreshQueue.length === 0) return;
          faviconRefreshRunning = true;
          const { api } = await import("@services/api.ts");

          while (faviconRefreshQueue.length > 0) {
            const item = faviconRefreshQueue.shift();
            if (!item) continue;
            try {
              const res = await api<{ favicon?: string }>(`/bookmarks/${item.id}/refresh-favicon`, { method: "POST" });
              if (res?.favicon && item.target.parentElement) {
                const parent = item.target.parentElement;
                const url = String(res.favicon).trim();
                const safe = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/");
                if (safe) {
                  const img = document.createElement("img");
                  img.className = "bookmark-favicon-img";
                  img.loading = "lazy";
                  img.src = `${url}?t=${Date.now()}`;
                  parent.innerHTML = "";
                  parent.appendChild(img);
                }
              }
            } catch { /* ignore fallback already shown */ }
            await new Promise(r => setTimeout(r, 100));
          }
          faviconRefreshRunning = false;
        };

        document.addEventListener("error", (e) => {
          const target = e.target as HTMLElement;
          if (!(target instanceof HTMLImageElement)) return;

          if (target.classList.contains("bookmark-favicon-img")) {
            const iconHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon icon-link" style="width: 24px; height: 24px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
            if (target.parentElement) target.parentElement.innerHTML = iconHtml;

            if (target.dataset.retryAttempted !== "true") {
              target.dataset.retryAttempted = "true";
              const card = target.closest(".bookmark-card") as HTMLElement;
              const id = card?.dataset.id;
              if (id) {
                faviconRefreshQueue.push({ id, target });
                processFaviconQueue();
              }
            }
          } else if (target.classList.contains("command-favicon") || target.closest(".blocked-link-item") || target.hasAttribute("data-fallback")) {
            target.style.display = "none";
          }
        }, { capture: true, signal: globalSignal.signal });
      },
    );
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Setup everything else when authenticated
      Promise.all([
        import("@features/bookmarks/settings.ts"),
        import("@features/auth/auth.ts"),
        import("@features/bookmarks/folders.ts"),
        import("@features/bookmarks/bookmarks.ts"),
        import("@services/api.ts"),
      ]).then(
        ([
          { loadSettings },
          { showMainApp, updateUserInfo },
          { loadFolders },
          { loadBookmarks },
          { api },
        ]) => {
          loadSettings().then(() => {
            showMainApp();
            updateUserInfo();

            Promise.all([
              loadFolders(),
              loadBookmarks(),
              api<{ version: string }>("/health")
                .then((res) => {
                  const versionEl = document.getElementById("app-version");
                  if (versionEl && res.version) {
                    versionEl.textContent = `v${res.version}`;
                  }
                })
                .catch((err) =>
                  console.warn("Failed to fetch app version", err),
                ),
            ]).then(() => {
              updateActiveNav();

              import("@features/bookmarks/smart-organization-ui.ts").then(
                (mod) => mod.default.init(),
              );
              initTagInput();
              import("@features/maintenance.ts").then(({ initMaintenance }) =>
                initMaintenance(),
              );
            });
          });
        },
      );
    }
  }, [isAuthenticated]);

  return <AppShell />;
}
