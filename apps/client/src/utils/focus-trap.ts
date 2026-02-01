/**
 * AnchorMarks - Focus Trap Utility
 * Manages keyboard focus within modal dialogs for accessibility
 */

import { logger } from "@utils/logger.ts";

// Map of active focus traps by element ID
const activeFocusTraps = new Map<string, FocusTrap>();

interface FocusTrapOptions {
  /** Element to return focus to when trap is released */
  returnFocusElement?: HTMLElement;
  /** Whether to focus the first element immediately */
  initialFocus?: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Selector for focusable elements (default: interactive elements) */
  focusableSelector?: string;
}

class FocusTrap {
  private container: HTMLElement;
  private returnFocusElement?: HTMLElement;
  private onEscape?: () => void;
  private focusableSelector: string;
  private previouslyFocused: HTMLElement | null = null;
  private isActive = false;

  private static readonly DEFAULT_FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(", ");

  constructor(container: HTMLElement, options: FocusTrapOptions = {}) {
    this.container = container;
    this.returnFocusElement = options.returnFocusElement;
    this.onEscape = options.onEscape;
    this.focusableSelector =
      options.focusableSelector || FocusTrap.DEFAULT_FOCUSABLE_SELECTOR;

    // Store currently focused element
    this.previouslyFocused = document.activeElement as HTMLElement;

    // Set initial focus if requested
    if (options.initialFocus !== false) {
      this.focusFirstElement();
    }
  }

  /**
   * Get all focusable elements within the container
   */
  private getFocusableElements(): HTMLElement[] {
    return Array.from(
      this.container.querySelectorAll<HTMLElement>(this.focusableSelector),
    ).filter((element) => {
      // Additional check for visibility
      return (
        element.offsetParent !== null && !element.hasAttribute("aria-hidden")
      );
    });
  }

  /**
   * Focus the first focusable element
   */
  private focusFirstElement(): void {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  /**
   * Focus the last focusable element
   */
  private focusLastElement(): void {
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
    }
  }

  /**
   * Handle keyboard navigation within the trap
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      if (this.onEscape) {
        event.preventDefault();
        this.onEscape();
      }
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    // Shift+Tab on first element -> focus last
    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    // Tab on last element -> focus first
    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
      return;
    }
  };

  /**
   * Activate the focus trap
   */
  activate(): void {
    if (this.isActive) {
      logger.warn("[FocusTrap] Trap already active", {
        container: this.container.id,
      });
      return;
    }

    document.addEventListener("keydown", this.handleKeyDown);
    this.isActive = true;
    logger.debug("[FocusTrap] Activated", { container: this.container.id });
  }

  /**
   * Deactivate the focus trap and restore previous focus
   */
  deactivate(): void {
    if (!this.isActive) {
      return;
    }

    document.removeEventListener("keydown", this.handleKeyDown);
    this.isActive = false;

    // Return focus to previously focused element or specified element
    const returnElement = this.returnFocusElement || this.previouslyFocused;
    if (returnElement && returnElement.focus) {
      // Use setTimeout to avoid focus conflicts with closing animations
      setTimeout(() => {
        returnElement.focus();
      }, 0);
    }

    logger.debug("[FocusTrap] Deactivated", { container: this.container.id });
  }
}

/**
 * Create and activate a focus trap for a container element
 */
export function createFocusTrap(
  container: HTMLElement | string,
  options: FocusTrapOptions = {},
): FocusTrap {
  const element =
    typeof container === "string"
      ? document.getElementById(container)
      : container;

  if (!element) {
    throw new Error(`[FocusTrap] Container not found: ${container}`);
  }

  // Deactivate existing trap for this element
  const existingTrap = activeFocusTraps.get(element.id);
  if (existingTrap) {
    existingTrap.deactivate();
  }

  const trap = new FocusTrap(element, options);
  trap.activate();

  if (element.id) {
    activeFocusTraps.set(element.id, trap);
  }

  return trap;
}

/**
 * Deactivate and remove focus trap for a container
 */
export function removeFocusTrap(container: HTMLElement | string): void {
  const elementId = typeof container === "string" ? container : container.id;

  const trap = activeFocusTraps.get(elementId);
  if (trap) {
    trap.deactivate();
    activeFocusTraps.delete(elementId);
  }
}

/**
 * Check if a focus trap is active for a container
 */
export function hasFocusTrap(container: HTMLElement | string): boolean {
  const elementId = typeof container === "string" ? container : container.id;

  return activeFocusTraps.has(elementId);
}

/**
 * Remove all active focus traps
 */
export function removeAllFocusTraps(): void {
  activeFocusTraps.forEach((trap) => trap.deactivate());
  activeFocusTraps.clear();
  logger.debug("[FocusTrap] Removed all traps");
}

// Export for debugging in development
if (import.meta.env.DEV) {
  (window as any).__focusTrapDebug = {
    activeFocusTraps,
    removeAll: removeAllFocusTraps,
  };
}
