import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { BookmarksProvider } from "./BookmarksContext";
import { ConfirmProvider } from "./ConfirmContext";
import { DashboardProvider } from "./DashboardContext";
import { FoldersProvider } from "./FoldersContext";
import { ModalProvider } from "./ModalContext";
import { ToastProvider } from "./ToastContext";
import { UIProvider } from "./UIContext";

/**
 * Composes all context providers into a single wrapper.
 * Wrap the app root with this to make all contexts available.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <ToastProvider>
          <UIProvider>
            <FoldersProvider>
              <BookmarksProvider>
                <DashboardProvider>
                  <ModalProvider>{children}</ModalProvider>
                </DashboardProvider>
              </BookmarksProvider>
            </FoldersProvider>
          </UIProvider>
        </ToastProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
