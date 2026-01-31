/**
 * AnchorMarks - Utils Module
 * Common utility functions
 */

// Escape HTML to prevent XSS
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Extract hostname from URL
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Extract base URL (origin) from a URL, e.g. https://example.com
export function getBaseUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

// Parse comma-separated tag input
export function parseTagInput(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Download blob as file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Safe localStorage wrapper with error handling
 * Handles private browsing mode and quota exceeded errors gracefully
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`localStorage.getItem failed for key "${key}":`, error);
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`localStorage.setItem failed for key "${key}":`, error);
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`localStorage.removeItem failed for key "${key}":`, error);
      return false;
    }
  },
};

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Async handler wrapper for event listeners
 * Automatically catches errors and displays user-friendly messages
 */
export function asyncHandler(
  handler: (event: Event) => Promise<void>,
  errorMessage = "An error occurred. Please try again.",
): (event: Event) => void {
  return (event: Event) => {
    handler(event).catch((error) => {
      console.error("Async handler error:", error);
      // Try to show toast if available
      const showToast = (window as any).showToast;
      if (typeof showToast === "function") {
        showToast(errorMessage, "error");
      }
    });
  };
}

export default {
  escapeHtml,
  getHostname,
  getBaseUrl,
  parseTagInput,
  downloadBlob,
  safeLocalStorage,
  debounce,
  asyncHandler,
};
