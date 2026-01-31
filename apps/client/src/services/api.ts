/**
 * AnchorMarks - API Module
 * Handles all API communication with the backend
 */

import * as state from "@features/state.ts";

// Request deduplication: cache pending requests to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<any>>();

// Request metadata for cleanup
const requestMetadata = new Map<string, { timestamp: number }>();

// Default timeout for requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Cleanup stale pending requests periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, metadata] of requestMetadata.entries()) {
    if (now - metadata.timestamp > CLEANUP_INTERVAL_MS) {
      pendingRequests.delete(key);
      requestMetadata.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

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
 * @param {number} timeout - Request timeout in milliseconds (default: 30000)
 * @returns {Promise<T>} - The response data with type safety.
 */
export async function api<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT_MS,
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
      requestMetadata.delete(requestKey);
    } else {
      return existingPromise;
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Always send CSRF token for state-changing requests
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method) && state.csrfToken) {
    headers["X-CSRF-Token"] = state.csrfToken;
  }

  // Create AbortController for timeout and cancellation
  const abortController = new AbortController();
  const signal = options.signal || abortController.signal;
  
  // Set up timeout
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeout);

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
        // Special handling for CSRF errors
        if (
          errorMessage.toLowerCase().includes("csrf") ||
          errorMessage.toLowerCase().includes("x-csrf-token")
        ) {
          state.setCsrfToken(null);
          // Optionally trigger re-auth or reload UI
        }
        throw new Error(errorMessage);
      }

      return data;
    } catch (err) {
      // Handle AbortError gracefully
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Request timeout or cancelled");
      }
      throw err;
    } finally {
      // Clear timeout
      clearTimeout(timeoutId);
      // Remove from pending requests when done (success or failure)
      if (requestKey) {
        pendingRequests.delete(requestKey);
        requestMetadata.delete(requestKey);
      }
    }
  })();

  // Cache the promise for GET requests
  if (requestKey) {
    pendingRequests.set(requestKey, fetchPromise);
    requestMetadata.set(requestKey, { timestamp: Date.now() });
  }

  // Expose abort method on the promise for convenience
  (fetchPromise as any).abort = () => {
    clearTimeout(timeoutId);
    abortController.abort();
    if (requestKey) {
      pendingRequests.delete(requestKey);
      requestMetadata.delete(requestKey);
    }
  };

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
    requestMetadata.delete(requestKey);
  }
}

export default { api };
