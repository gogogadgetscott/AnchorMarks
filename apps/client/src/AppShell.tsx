import { ModalPortal } from "@components/modals/ModalPortal.tsx";
import { Header } from "@components/Header.tsx";
import { WidgetPicker } from "@components/WidgetPicker.tsx";
import { BookmarksList } from "@components/BookmarksList.tsx";
import { useAuth } from "./contexts/AuthContext";
import authScreen from "@layouts/fragments/auth-screen.html?raw";
import sidebar from "@layouts/fragments/sidebar.html?raw";
import toast from "@layouts/fragments/toast.html?raw";

const sidebarHtml = sidebar.replace(
  "%VITE_APP_VERSION%",
  import.meta.env.VITE_APP_VERSION ?? "",
);

const externalModalsMarkup = toast;

/**
 * React shell that preserves legacy DOM structure while migration is in progress.
 */
export function AppShell() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* Auth Screen (Legacy) */}
      <div
        style={{ display: isAuthenticated ? "none" : "contents" }}
        dangerouslySetInnerHTML={{ __html: authScreen }}
      />

      {/* Main App */}
      <div
        id="main-app"
        className={`main-app ${!isAuthenticated ? "hidden" : ""}`}
      >
        <div className="sidebar-backdrop" id="sidebar-backdrop"></div>

        {/* Sidebar (Legacy) */}
        <div
          dangerouslySetInnerHTML={{ __html: sidebarHtml }}
          style={{ display: "contents" }}
        />

        {/* Main Content (Migrated to React) */}
        <main className="main-content">
          <div id="headers-container">
            <Header />
            <WidgetPicker />
          </div>
          <div id="bulk-bar-container"></div>

          <div className="content-body">
            <div
              id="smart-insights-widget"
              className="smart-insights-widget"
              style={{ display: "none" }}
            ></div>

            <BookmarksList />

            <div id="empty-state-container">
              <div id="empty-state" className="empty-state hidden"></div>
            </div>
          </div>
        </main>
      </div>

      {/* React Modals */}
      <ModalPortal />

      {/* Legacy Toasts */}
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: externalModalsMarkup }}
      />
    </>
  );
}
