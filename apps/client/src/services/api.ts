/**
 * AnchorMarks - API Module
 * Handles all API communication with the backend
 */

import * as state from "@features/state.ts";

/**
 * API Helper
 * @param {string} endpoint - The API endpoint to call.
 * @param {RequestInit} options - Standard fetch options.
 * @returns {Promise<any>} - The response data.
 */
export async function api(
  endpoint: string,
  options: RequestInit = {},
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (state.csrfToken) headers["X-CSRF-Token"] = state.csrfToken;

  const response = await fetch(`${state.API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (response.status === 401) {
    // Clear local auth state without making another API call
    state.setCsrfToken(null);
    state.setCurrentUser(null);
    state.setIsAuthenticated(false);
    // Show auth screen (import dynamically to avoid circular dependency)
    const { showAuthScreen } = await import("@features/auth/auth.ts");
    showAuthScreen();
    throw new Error("Session expired");
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "API Error");
  return data;
}

export default { api };
