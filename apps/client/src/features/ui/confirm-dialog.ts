/**
 * AnchorMarks - Confirm Dialog
 * A generic replacement for separate confirm() calls.
 */

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean; // If true, confirm button is red
}

export class ConfirmDialog {
  private static instance: ConfirmDialog;
  private modalElement: HTMLElement | null = null;
  private handleKeydown: ((e: KeyboardEvent) => void) | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): ConfirmDialog {
    if (!ConfirmDialog.instance) {
      ConfirmDialog.instance = new ConfirmDialog();
    }
    return ConfirmDialog.instance;
  }

  private createModalElement(): HTMLElement {
    // Construct the modal HTML
    const modal = document.createElement("div");
    modal.id = "generic-confirm-modal";
    modal.className = "modal hidden modal-sm"; // Reusing .modal-sm for small dialog
    modal.style.zIndex = "1001"; // Ensure it is above other modals if necessary

    modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header" style="padding: 1rem 1.5rem; min-height: auto;">
                    <h2 class="confirm-title" style="font-size: 1.1rem; margin: 0;">Confirm</h2>
                </div>
                <div class="modal-body" style="padding: 1.5rem; padding-bottom: 0;">
                    <p class="confirm-message" style="margin: 0; color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;"></p>
                </div>
                <div class="modal-footer" style="padding: 1.25rem 1.5rem; justify-content: flex-end; gap: 0.75rem; border-top: none; margin-top: 0.5rem;">
                    <button class="btn btn-ghost confirm-cancel" style="font-weight: 500;">Cancel</button>
                    <button class="btn btn-primary confirm-ok" style="font-weight: 500;">Confirm</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);
    return modal;
  }

  public show(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      // 1. Setup DOM
      if (!this.modalElement) {
        this.modalElement = document.getElementById("generic-confirm-modal");
        if (!this.modalElement) {
          this.modalElement = this.createModalElement();
        }
      }

      // 2. Update Content
      const titleEl = this.modalElement.querySelector(".confirm-title");
      const msgEl = this.modalElement.querySelector(".confirm-message");
      const okBtn = this.modalElement.querySelector(
        ".confirm-ok",
      ) as HTMLElement;
      const cancelBtn = this.modalElement.querySelector(
        ".confirm-cancel",
      ) as HTMLElement;

      if (titleEl) titleEl.textContent = options.title || "Confirm";
      if (msgEl) msgEl.textContent = message;

      if (okBtn) {
        okBtn.textContent = options.confirmText || "Confirm";
        // Handle destructive style
        if (options.destructive) {
          okBtn.className = "btn btn-danger confirm-ok";
        } else {
          okBtn.className = "btn btn-primary confirm-ok";
        }
      }
      if (cancelBtn) cancelBtn.textContent = options.cancelText || "Cancel";

      // 3. Setup Listeners

      // Define handlers
      const cleanup = () => {
        this.modalElement?.classList.add("hidden");
        // Remove listeners to avoid leaks/double fires
        okBtn?.removeEventListener("click", onConfirm);
        cancelBtn?.removeEventListener("click", onCancel);
        backdrop?.removeEventListener("click", onCancel);
        if (this.handleKeydown) {
          window.removeEventListener("keydown", this.handleKeydown);
          this.handleKeydown = null;
        }
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      // Attach listeners
      okBtn?.addEventListener("click", onConfirm);
      cancelBtn?.addEventListener("click", onCancel);

      const backdrop = this.modalElement.querySelector(".modal-backdrop");
      backdrop?.addEventListener("click", onCancel);

      // Escape key support
      this.handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation(); // Prevent closing other parents if any
          onCancel();
        }
      };
      window.addEventListener("keydown", this.handleKeydown);

      // 4. Show Modal
      this.modalElement.classList.remove("hidden");
      // Focus the cancel button by default to avoid accidental confirms, OR focus confirm if it's not destructive?
      // Standard UX often focuses the primary action, but for destructive it should be cancel.
      if (options.destructive) {
        cancelBtn?.focus();
      } else {
        okBtn?.focus();
      }
    });
  }
}


export const confirmDialog = (message: string, options?: ConfirmOptions) =>
  ConfirmDialog.getInstance().show(message, options);

export interface PromptOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
}

export class PromptDialog {
  private static instance: PromptDialog;
  private modalElement: HTMLElement | null = null;
  private handleKeydown: ((e: KeyboardEvent) => void) | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): PromptDialog {
    if (!PromptDialog.instance) {
      PromptDialog.instance = new PromptDialog();
    }
    return PromptDialog.instance;
  }

  private createModalElement(): HTMLElement {
    const modal = document.createElement("div");
    modal.id = "generic-prompt-modal";
    modal.className = "modal hidden modal-sm";
    modal.style.zIndex = "1002"; // Above confirm dialog if necessary

    modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header" style="padding: 1rem 1.5rem; min-height: auto;">
                    <h2 class="prompt-title" style="font-size: 1.1rem; margin: 0;">Prompt</h2>
                </div>
                <div class="modal-body" style="padding: 1.5rem; padding-bottom: 0;">
                    <p class="prompt-message" style="margin: 0; margin-bottom: 1rem; color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;"></p>
                    <input type="text" class="form-control prompt-input" style="width: 100%; box-sizing: border-box;" />
                </div>
                <div class="modal-footer" style="padding: 1.25rem 1.5rem; justify-content: flex-end; gap: 0.75rem; border-top: none; margin-top: 0.5rem;">
                    <button class="btn btn-ghost prompt-cancel" style="font-weight: 500;">Cancel</button>
                    <button class="btn btn-primary prompt-ok" style="font-weight: 500;">OK</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);
    return modal;
  }

  public show(message: string, options: PromptOptions = {}): Promise<string | null> {
    return new Promise((resolve) => {
      // 1. Setup DOM
      if (!this.modalElement) {
        this.modalElement = document.getElementById("generic-prompt-modal");
        if (!this.modalElement) {
          this.modalElement = this.createModalElement();
        }
      }

      // 2. Update Content
      const titleEl = this.modalElement.querySelector(".prompt-title");
      const msgEl = this.modalElement.querySelector(".prompt-message");
      const inputEl = this.modalElement.querySelector(".prompt-input") as HTMLInputElement;
      const okBtn = this.modalElement.querySelector(".prompt-ok") as HTMLElement;
      const cancelBtn = this.modalElement.querySelector(".prompt-cancel") as HTMLElement;

      if (titleEl) titleEl.textContent = options.title || "Input Required";
      if (msgEl) msgEl.textContent = message;

      if (inputEl) {
        inputEl.value = options.defaultValue || "";
        inputEl.placeholder = options.placeholder || "";
      }

      if (okBtn) okBtn.textContent = options.confirmText || "OK";
      if (cancelBtn) cancelBtn.textContent = options.cancelText || "Cancel";

      // 3. Setup Listeners
      const cleanup = () => {
        this.modalElement?.classList.add("hidden");
        // Remove listeners
        okBtn?.removeEventListener("click", onConfirm);
        cancelBtn?.removeEventListener("click", onCancel);
        backdrop?.removeEventListener("click", onCancel);
        inputEl?.removeEventListener("keydown", onInputKeydown);
        if (this.handleKeydown) {
          window.removeEventListener("keydown", this.handleKeydown);
          this.handleKeydown = null;
        }
      };

      const onConfirm = () => {
        const value = inputEl ? inputEl.value : "";
        cleanup();
        resolve(value);
      };

      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      const onInputKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirm();
        }
      };

      // Attach listeners
      okBtn?.addEventListener("click", onConfirm);
      cancelBtn?.addEventListener("click", onCancel);
      inputEl?.addEventListener("keydown", onInputKeydown);

      const backdrop = this.modalElement.querySelector(".modal-backdrop");
      backdrop?.addEventListener("click", onCancel);

      // Escape key support
      this.handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      };
      window.addEventListener("keydown", this.handleKeydown);

      // 4. Show Modal
      this.modalElement.classList.remove("hidden");
      
      // Focus input
      setTimeout(() => {
        inputEl?.focus();
        inputEl?.select();
      }, 50);
    });
  }
}

export const promptDialog = (message: string, options?: PromptOptions) =>
  PromptDialog.getInstance().show(message, options);
