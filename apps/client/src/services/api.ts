/**
 * AnchorMarks - API Module
 * Handles all API communication with the backend
 */

import * as state from "@features/state.ts";

/**
 * API Helper
 * @param {string} endpoint - The API endpoint to call.
 * @param {RequestInit} options - Standard fetch options.
 * @returns {Promise<T>} - The response data with type safety.
 */
export async function api<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
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

  // Handle non-JSON responses (e.g., HTML error pages, empty responses)
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  let data: T;
  try {
    if (isJson) {
      data = await response.json();
    } else {
      // For non-JSON responses, try to get text for better error messages
      const text = await response.text();
      throw new Error(
        `Invalid response format (expected JSON, got ${contentType || "unknown"}): ${text.substring(0, 100)}`,
      );
    }
  } catch (err) {
    // If JSON parsing fails or response is not JSON, provide helpful error
    if (err instanceof SyntaxError) {
      throw new Error(
        `Failed to parse JSON response: ${response.status} ${response.statusText}`,
      );
    }
    throw err;
  }

  if (!response.ok) {
    const errorMessage =
      (data as any)?.error ||
      `API Error: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data;
}

export default { api };
