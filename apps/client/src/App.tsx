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
      const themeSelect = document.getElementById(
        "theme-select",
      ) as HTMLSelectElement;
      if (themeSelect) themeSelect.value = savedTheme;
    }

    // Security: hide auth forms if user might be authenticated
    const authScreen = document.getElementById("auth-screen");
    if (authScreen && !authScreen.classList.contains("hidden")) {
      ["login-form", "register-form"].forEach((id) => {
        const form = document.getElementById(id);
        if (form) {
          form.setAttribute("data-bitwarden-watching", "false");
          form.setAttribute("data-lpignore", "true");
          form.style.display = "none";
        }
      });
    }

    // Initialize global listeners
    Promise.all([
      import("@features/ui/navigation.ts"),
      import("@features/ui/forms.ts"),
      import("@features/ui/interactions.ts"),
      import("@features/ui/tags.ts"),
      import("@features/keyboard/handler.ts"),
      import("@utils/event-cleanup.ts"),
      import("@features/auth/auth.ts").then((m) => m.checkAuth()),
    ]).then(
      ([
        { initNavigationListeners },
        { initFormListeners },
        { initInteractions },
        { initTagListeners },
        { handleKeyboard },
        { registerGlobalCleanup },
        isAuthed,
      ]) => {
        initNavigationListeners();
        initFormListeners();

        if (!isAuthed) {
          import("@features/ui/omnibar.ts").then(({ initOmnibarListeners }) => {
            initOmnibarListeners();
          });
        }

        initInteractions();
        initTagListeners();

        const globalSignal = registerGlobalCleanup();

        document.addEventListener("keydown", handleKeyboard, {
          capture: true,
          signal: globalSignal.signal,
        });
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
