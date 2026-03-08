import React from "react";
import { Sidebar } from "@components/Sidebar.tsx";
import { Header } from "@components/Header.tsx";
import { WidgetPicker } from "@components/WidgetPicker.tsx";
import { BookmarksList } from "@components/BookmarksList.tsx";
import { BulkBar } from "@components/BulkBar.tsx";
import { AuthScreen } from "@components/AuthScreen.tsx";
import { ModalPortal } from "@components/modals/ModalPortal.tsx";
import { useAuth } from "./contexts/AuthContext";
import { useBookmarks } from "./contexts/BookmarksContext";
import toastHtml from "@layouts/fragments/toast.html?raw";

/**
 * AppShell handles the overall layout and conditional rendering based on auth status.
 */
export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const { bulkMode } = useBookmarks();

  return (
    <>
      {!isAuthenticated ? (
        <AuthScreen />
      ) : (
        <div id="main-app" className="main-app">
          <div className="sidebar-backdrop" id="sidebar-backdrop"></div>

          <Sidebar />

          <main className="main-content">
            <div id="headers-container">
              <Header />
              <WidgetPicker />
            </div>

            <div id="bulk-bar-container">{bulkMode && <BulkBar />}</div>

            <div className="content-body">
              <BookmarksList />

              <div id="empty-state-container">
                <div id="empty-state" className="empty-state hidden"></div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* React Modals */}
      <ModalPortal />

      {/* Legacy Toasts (Keep for now as no React replacement exists) */}
      <div
        style={{ display: "contents" }}
        dangerouslySetInnerHTML={{ __html: toastHtml }}
      />
    </>
  );
}
