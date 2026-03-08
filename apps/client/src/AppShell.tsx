import { Sidebar } from "@components/Sidebar.tsx";
import { Header } from "@components/Header.tsx";
import { WidgetPicker } from "@components/WidgetPicker.tsx";
import { BookmarksList } from "@components/BookmarksList.tsx";
import { BulkBar } from "@components/BulkBar.tsx";
import { AuthScreen } from "@components/AuthScreen.tsx";
import { ModalPortal } from "@components/modals/ModalPortal.tsx";
import { EmptyState } from "@components/EmptyState.tsx";
import { useAuth } from "./contexts/AuthContext";
import { useBookmarks } from "./contexts/BookmarksContext";

/**
 * AppShell handles the overall layout and conditional rendering based on auth status.
 */
export function AppShell() {
  const { isAuthenticated } = useAuth();
  const { bulkMode } = useBookmarks();

  return (
    <>
      {!isAuthenticated ? (
        <AuthScreen />
      ) : (
        <div id="main-app" className="main-app">
          <div
            className="sidebar-backdrop"
            id="sidebar-backdrop"
            onClick={() => document.body.classList.remove("mobile-sidebar-open")}
          ></div>

          <Sidebar />

          <main className="main-content">
            <div id="headers-container">
              <Header />
              <WidgetPicker />
            </div>

            <div id="bulk-bar-container">{bulkMode && <BulkBar />}</div>

            <div className="content-body">
              <BookmarksList />
              <EmptyState />
            </div>
          </main>
        </div>
      )}

      {/* React Modals */}
      <ModalPortal />
    </>
  );
}
