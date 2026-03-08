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
  type TagPickerOptions,
} from "@/contexts/ConfirmContext";

/**
 * Legacy confirmDialog bridge
 */
export const confirmDialog = (message: string, options?: ConfirmOptions) =>
  ConfirmDialog.getInstance().show(message, options);

/**
 * Legacy promptDialog bridge
 */
export const promptDialog = (message: string, options?: PromptOptions) =>
  showPrompt(message, options);

/**
 * Legacy tagPickerDialog bridge
 */
export const tagPickerDialog = (options?: TagPickerOptions) =>
  TagPickerDialog.getInstance().show(options);

// For compatibility with any code that still uses the class instances directly (though unlikely)
export class ConfirmDialog {
  private static instance: ConfirmDialog | undefined;

  public static getInstance() {
    if (!ConfirmDialog.instance) {
      ConfirmDialog.instance = new ConfirmDialog();
    }
    return ConfirmDialog.instance;
  }

  public show(message: string, options?: ConfirmOptions): Promise<boolean> {
    return showConfirm(message, options);
  }
}

export class PromptDialog {
  public static getInstance() {
    return {
      show: (message: string, options?: PromptOptions) =>
        showPrompt(message, options),
    };
  }
}

export class TagPickerDialog {
  private static instance: TagPickerDialog | undefined;

  public static getInstance() {
    if (!TagPickerDialog.instance) {
      TagPickerDialog.instance = new TagPickerDialog();
    }
    return TagPickerDialog.instance;
  }

  public show(options?: TagPickerOptions): Promise<string[] | null> {
    return showTagPicker(options);
  }
}
