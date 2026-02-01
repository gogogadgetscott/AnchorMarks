/**
 * AnchorMarks - Event Cleanup System
 * Manages event listener lifecycle to prevent memory leaks
 */

import { logger } from "@utils/logger.ts";

// Map of view names to AbortControllers
const viewCleanupRegistry = new Map<string, AbortController>();

// Global cleanup controller for app-level listeners
let globalCleanupController: AbortController | null = null;

/**
 * Register a cleanup controller for a specific view
 * Call this when initializing a view's event listeners
 */
export function registerViewCleanup(viewName: string): AbortController {
  // Clean up existing controller if present
  if (viewCleanupRegistry.has(viewName)) {
    const existing = viewCleanupRegistry.get(viewName);
    existing?.abort();
    logger.debug(
      `[EventCleanup] Cleaned up existing listeners for view: ${viewName}`,
    );
  }

  const controller = new AbortController();
  viewCleanupRegistry.set(viewName, controller);
  logger.debug(
    `[EventCleanup] Registered cleanup controller for view: ${viewName}`,
  );
  return controller;
}

/**
 * Clean up event listeners for a specific view
 * Call this when navigating away from a view
 */
export function cleanupView(viewName: string): void {
  const controller = viewCleanupRegistry.get(viewName);
  if (controller) {
    controller.abort();
    viewCleanupRegistry.delete(viewName);
    logger.debug(`[EventCleanup] Cleaned up view: ${viewName}`);
  }
}

/**
 * Clean up all view-specific event listeners
 * Call this on app shutdown or full reset
 */
export function cleanupAllViews(): void {
  logger.debug(`[EventCleanup] Cleaning up ${viewCleanupRegistry.size} views`);
  viewCleanupRegistry.forEach((controller) => {
    controller.abort();
  });
  viewCleanupRegistry.clear();
}

/**
 * Register global app-level cleanup controller
 * Use for document/window event listeners that persist across views
 */
export function registerGlobalCleanup(): AbortController {
  if (globalCleanupController) {
    globalCleanupController.abort();
  }
  globalCleanupController = new AbortController();
  logger.debug("[EventCleanup] Registered global cleanup controller");
  return globalCleanupController;
}

/**
 * Clean up global app-level listeners
 * Call this only on app shutdown
 */
export function cleanupGlobal(): void {
  if (globalCleanupController) {
    globalCleanupController.abort();
    globalCleanupController = null;
    logger.debug("[EventCleanup] Cleaned up global listeners");
  }
}

/**
 * Add an event listener with automatic cleanup support
 * Convenience wrapper around addEventListener with signal
 */
export function addManagedListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | Document | Window | null,
  event: K | string,
  handler: EventListenerOrEventListenerObject,
  signal: AbortSignal,
  options: AddEventListenerOptions = {},
): void {
  if (!element) {
    logger.warn(`[EventCleanup] Attempted to add listener to null element`);
    return;
  }

  try {
    element.addEventListener(event as any, handler, {
      ...options,
      signal,
    });
  } catch (error) {
    logger.error(
      `[EventCleanup] Failed to add listener for event: ${event}`,
      error,
    );
  }
}

/**
 * Get the AbortSignal for a specific view
 * Returns null if view cleanup isn't registered
 */
export function getViewSignal(viewName: string): AbortSignal | null {
  const controller = viewCleanupRegistry.get(viewName);
  return controller?.signal || null;
}

/**
 * Get the global AbortSignal
 * Returns null if global cleanup isn't registered
 */
export function getGlobalSignal(): AbortSignal | null {
  return globalCleanupController?.signal || null;
}

/**
 * Check if a view's cleanup controller exists
 */
export function hasViewCleanup(viewName: string): boolean {
  return viewCleanupRegistry.has(viewName);
}

/**
 * Get statistics about registered cleanup controllers
 * Useful for debugging memory leaks
 */
export function getCleanupStats(): {
  registeredViews: string[];
  viewCount: number;
  hasGlobal: boolean;
} {
  return {
    registeredViews: Array.from(viewCleanupRegistry.keys()),
    viewCount: viewCleanupRegistry.size,
    hasGlobal: globalCleanupController !== null,
  };
}

// Export for debugging in development
if (import.meta.env.DEV) {
  (window as any).__eventCleanupDebug = {
    getStats: getCleanupStats,
    cleanupView,
    cleanupAllViews,
    registry: viewCleanupRegistry,
  };
}
