/**
 * AnchorMarks - Error Handling Utilities
 * Centralized error handling for API errors and network issues
 */

/**
 * Check if an error is a network/server error
 */
export function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("unexpected token") ||
    message.includes("json") ||
    /5\d\d/.test(message)
  );
}

/**
 * Get user-friendly error message for network errors
 */
export function getNetworkErrorMessage(error: Error): string {
  if (error.message.match(/5\d\d/)) {
    return "Server error. Please try again later.";
  }
  return "Server is unreachable. Please check your connection.";
}

/**
 * Show server status banner for network errors
 */
export function showServerStatusBanner(message: string): void {
  const banner = document.getElementById("server-status-banner");
  const messageEl = document.getElementById("server-status-message");
  if (banner) {
    banner.classList.remove("hidden");
    if (messageEl) {
      messageEl.textContent = message;
    }
  }
}

/**
 * Hide server status banner
 */
export function hideServerStatusBanner(): void {
  const banner = document.getElementById("server-status-banner");
  if (banner) {
    banner.classList.add("hidden");
  }
}

/**
 * Handle API errors with optional banner display
 * @param error - The error object
 * @param showBanner - Whether to show server status banner for network errors
 * @returns The error message to display to user
 */
export function handleApiError(
  error: unknown,
  showBanner = true,
): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message || "An unexpected error occurred";

  if (showBanner && isNetworkError(err)) {
    showServerStatusBanner(getNetworkErrorMessage(err));
  } else if (showBanner) {
    hideServerStatusBanner();
  }

  return message;
}

import { logError as loggerError } from "./logger.ts";

/**
 * Log error to console (only in development)
 * @deprecated Use logger.error() from logger.ts instead
 */
export function logError(error: unknown, context?: string): void {
  const message = context || "Error";
  if (error instanceof Error) {
    loggerError(message, error);
  } else {
    loggerError(message, new Error(String(error)));
  }
}

/**
 * Initialize global error handlers for unhandled errors and promise rejections
 */
import { logger } from "./logger.ts";

export function initGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    logger.error("Unhandled Promise Rejection", event.reason);
    
    // Prevent default browser error logging in production
    if (import.meta.env.PROD) {
      event.preventDefault();
    }
    
    // Show user-friendly error message
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const errorMessage = handleApiError(error, false);
    
    // Only show toast if we have the UI helper available
    try {
      import("@utils/ui-helpers.ts").then(({ showToast }) => {
        showToast(`An error occurred: ${errorMessage}`, "error");
      });
    } catch {
      // UI helper not available yet, just log
    }
  });

  // Handle general JavaScript errors
  window.addEventListener("error", (event: ErrorEvent) => {
    logger.error("Global Error Handler", event.error || new Error(event.message));
    
    // Show user-friendly error message for runtime errors
    if (event.error) {
      const errorMessage = handleApiError(event.error, false);
      try {
        import("@utils/ui-helpers.ts").then(({ showToast }) => {
          showToast(`An error occurred: ${errorMessage}`, "error");
        });
      } catch {
        // UI helper not available yet
      }
    }
  });
}

