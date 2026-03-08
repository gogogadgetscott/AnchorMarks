/**
 * Shared test utilities for React component tests.
 * Provides a wrapper with all context providers so components
 * that use useUI(), useBookmarks(), etc. can render without errors.
 */
import { type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { AppProviders } from "./contexts/AppProviders";

function AllProviders({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

/**
 * Drop-in replacement for RTL's render() that wraps with all contexts.
 */
function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { renderWithProviders };
export { screen, fireEvent, waitFor, act } from "@testing-library/react";
export { userEvent } from "@testing-library/user-event";
