import { describe, it, expect, vi, afterEach } from "vitest";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import { AppShell } from "../AppShell";
import { AppProviders } from "../contexts/AppProviders";

// Hoisted mock for isAuthenticated — value can be changed between tests
const mockAuth = vi.hoisted(() => ({ isAuthenticated: false }));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mockAuth.isAuthenticated }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Suppress import-meta env in tests
vi.stubEnv("VITE_APP_VERSION", "test");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockAuth.isAuthenticated = false;
});

describe("AppShell", () => {
  const renderShell = () =>
    render(
      <AppProviders>
        <AppShell />
      </AppProviders>,
    );

  it("shows auth screen when unauthenticated", async () => {
    mockAuth.isAuthenticated = false;
    const view = renderShell();

    await waitFor(() => {
      const authScreen = view.container.querySelector("#auth-screen");
      const mainApp = view.container.querySelector("#main-app");

      expect(authScreen).not.toBeNull();
      expect(mainApp).not.toBeNull();
      expect(authScreen?.classList.contains("hidden")).toBe(false);
      expect(mainApp?.classList.contains("hidden")).toBe(true);
    });
  });

  it("shows main app when authenticated", async () => {
    mockAuth.isAuthenticated = true;
    const view = renderShell();

    await act(async () => {});

    await waitFor(() => {
      const authScreen = view.container.querySelector("#auth-screen");
      const mainApp = view.container.querySelector("#main-app");
      const authWrapper = authScreen?.parentElement as HTMLElement | null;

      expect(authScreen).not.toBeNull();
      expect(mainApp).not.toBeNull();
      const authHiddenByClass =
        authScreen?.classList.contains("hidden") ?? false;
      const authHiddenByStyle = authWrapper?.style.display === "none";
      expect(authHiddenByClass || authHiddenByStyle).toBe(true);
      expect(mainApp?.classList.contains("hidden")).toBe(false);
    });
  });

  it("renders baseline shell containers", async () => {
    mockAuth.isAuthenticated = false;
    const view = renderShell();

    await waitFor(() => {
      expect(view.container.querySelector("#headers-container")).not.toBeNull();
      expect(
        view.container.querySelector("#empty-state-container"),
      ).not.toBeNull();
      expect(view.container.querySelector("#bookmark-modal")).not.toBeNull();
      expect(view.container.querySelector("#settings-modal")).not.toBeNull();
    });
  });
});
