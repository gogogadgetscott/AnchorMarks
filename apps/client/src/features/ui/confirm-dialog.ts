/**
 * AnchorMarks - Confirm Dialog (Legacy Bridge)
 * Bridges legacy imperative calls to the new React-based ConfirmContext.
 */

import {
  showConfirm,
  showPrompt,
  showTagPicker,
  type ConfirmOptions,
  type PromptOptions,
  type TagPickerOptions
} from "@/contexts/ConfirmContext";

/**
 * Legacy confirmDialog bridge
 */
export const confirmDialog = (message: string, options?: ConfirmOptions) =>
  showConfirm(message, options);

/**
 * Legacy promptDialog bridge
 */
export const promptDialog = (message: string, options?: PromptOptions) =>
  showPrompt(message, options);

/**
 * Legacy tagPickerDialog bridge
 */
export const tagPickerDialog = (options?: TagPickerOptions) =>
  showTagPicker(options);

// For compatibility with any code that still uses the class instances directly (though unlikely)
export class ConfirmDialog {
  public static getInstance() {
    return {
      show: (message: string, options?: ConfirmOptions) => showConfirm(message, options)
    };
  }
}

export class PromptDialog {
  public static getInstance() {
    return {
      show: (message: string, options?: PromptOptions) => showPrompt(message, options)
    };
  }
}

export class TagPickerDialog {
  public static getInstance() {
    return {
      show: (options?: TagPickerOptions) => showTagPicker(options)
    };
  }
}
