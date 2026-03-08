import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { BookmarksProvider } from "./BookmarksContext";
import { UIProvider } from "./UIContext";
import { FoldersProvider } from "./FoldersContext";
import { DashboardProvider } from "./DashboardContext";

/**
 * Composes all context providers into a single wrapper.
 * Wrap the app root with this to make all contexts available.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UIProvider>
        <FoldersProvider>
          <BookmarksProvider>
            <DashboardProvider>{children}</DashboardProvider>
          </BookmarksProvider>
        </FoldersProvider>
      </UIProvider>
    </AuthProvider>
  );
}
