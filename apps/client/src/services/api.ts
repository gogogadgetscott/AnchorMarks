/**
 * AnchorMarks - API Module
 * Handles all API communication with the backend
 */

import * as state from "@features/state.ts";

// Request deduplication: cache pending requests to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Generate a cache key for request deduplication
 */
function getRequestKey(endpoint: string, options: RequestInit): string {
  const method = options.method || "GET";
  const body = options.body ? String(options.body) : "";
  return `${method}:${endpoint}:${body}`;
}

/**
 * API Helper with request deduplication and cancellation support
 * @param {string} endpoint - The API endpoint to call.
 * @param {RequestInit} options - Standard fetch options. Can include signal for cancellation.
 * @returns {Promise<T>} - The response data with type safety.
 */
export async function api<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // For GET requests, check if there's already a pending request
  const isGet = !options.method || options.method === "GET";
  const requestKey = isGet ? getRequestKey(endpoint, options) : null;

  // Return existing promise if request is already in flight (unless cancelled)
  if (requestKey && pendingRequests.has(requestKey)) {
    const existingPromise = pendingRequests.get(requestKey)!;
    // Check if the existing request was cancelled
    if (options.signal && options.signal.aborted) {
      // Create new request if previous was cancelled
      pendingRequests.delete(requestKey);
    } else {
      return existingPromise;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (state.csrfToken) headers["X-CSRF-Token"] = state.csrfToken;
  // Add API key if present in state (for Flow Launcher, etc.)
  if (state.apiKey) headers["x-api-key"] = state.apiKey;

  // Create AbortController if signal provided or for cancellable requests
  const abortController = options.signal ? undefined : new AbortController();
  const signal = options.signal || abortController?.signal;

  // Create the fetch promise
  const fetchPromise = (async (): Promise<T> => {
    try {
      const response = await fetch(`${state.API_BASE}${endpoint}`, {
        ...options,
        signal,
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
    } catch (err) {
      // Handle AbortError gracefully
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Request cancelled");
      }
      throw err;
    } finally {
      // Remove from pending requests when done (success or failure)
      if (requestKey) {
        pendingRequests.delete(requestKey);
      }
    }
  })();

  // Cache the promise for GET requests
  if (requestKey) {
    pendingRequests.set(requestKey, fetchPromise);
  }

  // Store abort controller for cancellation
  if (abortController && requestKey) {
    // Expose abort method on the promise for convenience
    (fetchPromise as any).abort = () => {
      abortController.abort();
      pendingRequests.delete(requestKey);
    };
  }

  return fetchPromise;
}

/**
 * Create an abort controller for request cancellation
 * Useful for canceling requests when component unmounts or user navigates away
 */
export function createAbortController(): AbortController {
  return new AbortController();
}

/**
 * Cancel a pending request by endpoint and options
 * Note: This only works for GET requests that were deduplicated
 */
export function cancelRequest(
  endpoint: string,
  options: RequestInit = {},
): void {
  const requestKey = getRequestKey(endpoint, options);
  if (requestKey && pendingRequests.has(requestKey)) {
    const promise = pendingRequests.get(requestKey);
    if (promise && typeof (promise as any).abort === "function") {
      (promise as any).abort();
    }
    pendingRequests.delete(requestKey);
  }
}

export default { api };
