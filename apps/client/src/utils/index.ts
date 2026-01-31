/**
 * AnchorMarks - Utils Module
 * Common utility functions
 */

import { logger } from "./logger.ts";

// Escape HTML to prevent XSS
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize HTML - removes all tags except a safe allowlist
 * Use this when you need to allow some HTML formatting (e.g., links, bold)
 * For user-generated content that should have NO HTML, use escapeHtml instead.
 */
export function sanitizeHtml(
  html: string,
  options: {
    allowedTags?: string[];
    allowedAttributes?: string[];
  } = {},
): string {
  const {
    allowedTags = ["b", "i", "em", "strong", "a", "br", "p", "span"],
    allowedAttributes = ["href", "title", "target", "rel"],
  } = options;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = document.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT,
    null,
  );

  const nodesToRemove: Node[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Element;
    const tagName = node.tagName.toLowerCase();

    // Remove disallowed tags
    if (!allowedTags.includes(tagName)) {
      nodesToRemove.push(node);
      continue;
    }

    // Remove disallowed attributes
    Array.from(node.attributes).forEach((attr) => {
      if (!allowedAttributes.includes(attr.name.toLowerCase())) {
        node.removeAttribute(attr.name);
      }
    });

    // Extra security for links
    if (tagName === "a") {
      const href = node.getAttribute("href");
      if (href && href.match(/^javascript:/i)) {
        node.removeAttribute("href");
      }
      // Force external links to open in new tab safely
      if (href && !href.startsWith("#")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  }

  // Remove disallowed nodes
  nodesToRemove.forEach((node) => {
    const parent = node.parentNode;
    if (parent) {
      // Move children up before removing node
      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }
      parent.removeChild(node);
    }
  });

  return doc.body.innerHTML;
}

/**
 * Safely render HTML into a container element
 * Always escapes user content unless explicitly told to sanitize HTML
 */
export function safeRender(
  container: HTMLElement,
  content: string,
  options: { allowHtml?: boolean; sanitizeOptions?: any } = {},
): void {
  if (!container) {
    logger.warn("safeRender called with null/undefined container");
    return;
  }

  if (options.allowHtml) {
    container.innerHTML = sanitizeHtml(content, options.sanitizeOptions);
  } else {
    container.textContent = content;
  }
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
      logger.warn(`localStorage.getItem failed for key "${key}"`, error);
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      logger.warn(`localStorage.setItem failed for key "${key}"`, error);
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logger.warn(`localStorage.removeItem failed for key "${key}"`, error);
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
      logger.error("Async handler error", error);
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
  sanitizeHtml,
  safeRender,
  getHostname,
  getBaseUrl,
  parseTagInput,
  downloadBlob,
  safeLocalStorage,
  debounce,
  asyncHandler,
};
