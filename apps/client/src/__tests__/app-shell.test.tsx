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
      expect(mainApp).toBeNull();
    });
  });

  it("shows main app when authenticated", async () => {
    mockAuth.isAuthenticated = true;
    const view = renderShell();

    await act(async () => {});

    await waitFor(() => {
      const authScreen = view.container.querySelector("#auth-screen");
      const mainApp = view.container.querySelector("#main-app");

      expect(authScreen).toBeNull();
      expect(mainApp).not.toBeNull();
    });
  });

  it("renders baseline shell containers", async () => {
    mockAuth.isAuthenticated = true;
    const view = renderShell();

    await waitFor(() => {
      expect(view.container.querySelector("#headers-container")).not.toBeNull();
      expect(view.container.querySelector(".content-body")).not.toBeNull();
      expect(document.getElementById("modal-portal")).not.toBeNull();
    });
  });
});
