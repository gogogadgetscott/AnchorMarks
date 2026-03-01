/**
 * AnchorMarks - Confirm Dialog
 * A generic replacement for separate confirm() calls.
 */

import * as state from "@features/state.ts";
import { escapeHtml } from "@utils/index.ts";

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

  public show(
    message: string,
    options: PromptOptions = {},
  ): Promise<string | null> {
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
      const inputEl = this.modalElement.querySelector(
        ".prompt-input",
      ) as HTMLInputElement;
      const okBtn = this.modalElement.querySelector(
        ".prompt-ok",
      ) as HTMLElement;
      const cancelBtn = this.modalElement.querySelector(
        ".prompt-cancel",
      ) as HTMLElement;

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

export interface TagPickerOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  initialTags?: string[];
  selectionCount?: number;
}

export class TagPickerDialog {
  private static instance: TagPickerDialog;
  private modalElement: HTMLElement | null = null;
  private selectedTags: string[] = [];
  private autocompleteIndex = -1;
  private handleGlobalKeydown: ((e: KeyboardEvent) => void) | null = null;
  private handleClickOutside: ((e: Event) => void) | null = null;

  private constructor() {}

  public static getInstance(): TagPickerDialog {
    if (!TagPickerDialog.instance) {
      TagPickerDialog.instance = new TagPickerDialog();
    }
    return TagPickerDialog.instance;
  }

  private createModalElement(): HTMLElement {
    const modal = document.createElement("div");
    modal.id = "bulk-tag-picker-modal";
    modal.className = "modal hidden modal-tag-picker";
    modal.style.zIndex = "1002";
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="overflow: visible;">
        <div class="modal-header" style="padding: 1rem 1.5rem; min-height: auto;">
          <div>
            <h2 class="tag-picker-title" style="font-size: 1.1rem; margin: 0;">Tags</h2>
            <p class="tag-picker-subtitle" style="font-size: 0.82rem; color: var(--text-tertiary); margin: 0.2rem 0 0;"></p>
          </div>
          <button class="btn-icon tag-picker-cancel-x" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body" style="padding: 1rem 1.5rem 0.5rem; overflow: visible;">
          <div style="position: relative;">
            <div class="tags-input-container" id="bulk-tags-input-container">
              <div class="selected-tags" id="bulk-selected-tags"></div>
              <input type="text" id="bulk-tags-text-input" placeholder="Search or create tags…" autocomplete="off" />
            </div>
            <div class="tag-autocomplete" id="bulk-tag-autocomplete" style="display: none; max-height: 240px; overflow-y: auto;"></div>
          </div>
          <p style="font-size: 0.78rem; color: var(--text-tertiary); margin: 0.5rem 0 0; user-select: none;">
            Press <kbd style="font-size:0.72rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:3px;padding:1px 5px;">Enter</kbd>
            or <kbd style="font-size:0.72rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:3px;padding:1px 5px;">,</kbd>
            to add &nbsp;·&nbsp; <kbd style="font-size:0.72rem;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:3px;padding:1px 5px;">↑↓</kbd> to navigate
          </p>
        </div>
        <div class="modal-footer" style="padding: 1rem 1.5rem; justify-content: flex-end; gap: 0.75rem; margin-top: 0;">
          <button class="btn btn-ghost tag-picker-cancel" style="font-weight: 500;">Cancel</button>
          <button class="btn btn-primary tag-picker-ok" style="font-weight: 500;">Apply</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  private addTag(tagName: string): void {
    const normalized = tagName.trim();
    if (!normalized || this.selectedTags.includes(normalized)) return;
    this.selectedTags.push(normalized);
    this.renderSelectedTags();
    const input = document.getElementById("bulk-tags-text-input") as HTMLInputElement;
    if (input) { input.value = ""; input.focus(); }
    const ac = document.getElementById("bulk-tag-autocomplete") as HTMLElement;
    if (ac) this.hideAutocomplete(ac);
  }

  private removeTag(tagName: string): void {
    this.selectedTags = this.selectedTags.filter((t) => t !== tagName);
    this.renderSelectedTags();
  }

  private renderSelectedTags(): void {
    const container = document.getElementById("bulk-selected-tags");
    if (!container) return;
    container.innerHTML = this.selectedTags
      .map((tag) => {
        const meta = (state.tagMetadata[tag] as { color?: string }) || {};
        const color = meta.color || "#f59e0b";
        return `<span class="selected-tag" style="--tag-color: ${color}">
          <span class="selected-tag-name">${escapeHtml(tag)}</span>
          <button type="button" class="selected-tag-remove" data-tag="${JSON.stringify(tag).slice(1, -1)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </span>`;
      })
      .join("");
    container.querySelectorAll(".selected-tag-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeTag((btn as HTMLElement).dataset.tag || "");
      });
    });
  }

  private showAutocomplete(searchTerm: string, autocomplete: HTMLElement): void {
    const allTags = Object.keys(state.tagMetadata || {});
    let matches: string[];

    if (!searchTerm) {
      matches = allTags
        .filter((t) => !this.selectedTags.includes(t))
        .sort((a, b) => ((state.tagMetadata[b] as { count?: number })?.count || 0) - ((state.tagMetadata[a] as { count?: number })?.count || 0))
        .slice(0, 20);
    } else {
      matches = allTags
        .filter((t) => t.toLowerCase().includes(searchTerm.toLowerCase()) && !this.selectedTags.includes(t))
        .slice(0, 12);
    }

    const colorDot = (tag: string) => {
      const color = (state.tagMetadata[tag] as { color?: string })?.color || "#f59e0b";
      return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${escapeHtml(color)};flex-shrink:0;margin-right:0.4rem;"></span>`;
    };

    let html = matches
      .map((tag) => {
        const meta = state.tagMetadata[tag] as { count?: number };
        return `<div class="tag-autocomplete-item" data-tag="${JSON.stringify(tag).slice(1, -1)}">
          <span style="display:flex;align-items:center;">${colorDot(tag)}<span class="tag-autocomplete-name">${escapeHtml(tag)}</span></span>
          <span class="tag-autocomplete-count">${meta?.count ?? 0}</span>
        </div>`;
      })
      .join("");

    if (searchTerm && !matches.some((t) => t.toLowerCase() === searchTerm.toLowerCase()) && !this.selectedTags.includes(searchTerm)) {
      const isFirst = matches.length === 0;
      html += `<div class="tag-autocomplete-item tag-autocomplete-create ${isFirst ? "active" : ""}" data-tag="${JSON.stringify(searchTerm).slice(1, -1)}">
        <span style="display:flex;align-items:center;gap:0.35rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;flex-shrink:0;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span class="tag-autocomplete-name">Create "<strong>${escapeHtml(searchTerm)}</strong>"</span>
        </span>
        <span class="tag-autocomplete-count" style="background:var(--primary-100,rgba(99,102,241,0.15));color:var(--primary-600);">new</span>
      </div>`;
    } else if (matches.length > 0 && searchTerm) {
      html = html.replace('class="tag-autocomplete-item', 'class="tag-autocomplete-item active');
    }

    if (!html) {
      autocomplete.innerHTML = searchTerm
        ? '<div class="tag-autocomplete-empty">No matching tags — press Enter to create</div>'
        : '<div class="tag-autocomplete-empty">No tags yet</div>';
      autocomplete.style.display = searchTerm ? "block" : "none";
      this.autocompleteIndex = -1;
      return;
    }

    autocomplete.innerHTML = html;
    autocomplete.style.display = "block";
    this.autocompleteIndex = matches.length > 0 && searchTerm ? 0 : -1;

    autocomplete.querySelectorAll(".tag-autocomplete-item").forEach((item) => {
      item.addEventListener("click", () => {
        this.addTag((item as HTMLElement).dataset.tag || "");
      });
    });
  }

  private hideAutocomplete(autocomplete: HTMLElement): void {
    autocomplete.style.display = "none";
    this.autocompleteIndex = -1;
  }

  private navigateAutocomplete(direction: number, autocomplete: HTMLElement): void {
    const items = autocomplete.querySelectorAll(".tag-autocomplete-item");
    if (items.length === 0) return;
    items.forEach((i) => i.classList.remove("active"));
    this.autocompleteIndex += direction;
    if (this.autocompleteIndex < 0) this.autocompleteIndex = items.length - 1;
    if (this.autocompleteIndex >= items.length) this.autocompleteIndex = 0;
    items[this.autocompleteIndex].classList.add("active");
    items[this.autocompleteIndex].scrollIntoView({ block: "nearest" });
  }

  public show(options: TagPickerOptions = {}): Promise<string[] | null> {
    return new Promise((resolve) => {
      if (!this.modalElement) {
        this.modalElement = document.getElementById("bulk-tag-picker-modal");
        if (!this.modalElement) {
          this.modalElement = this.createModalElement();
        }
      }

      this.selectedTags = [...(options.initialTags || [])];
      this.autocompleteIndex = -1;

      const titleEl = this.modalElement.querySelector(".tag-picker-title");
      const subtitleEl = this.modalElement.querySelector(".tag-picker-subtitle");
      const okBtn = this.modalElement.querySelector(".tag-picker-ok") as HTMLElement;
      const cancelBtn = this.modalElement.querySelector(".tag-picker-cancel") as HTMLElement;
      const cancelXBtn = this.modalElement.querySelector(".tag-picker-cancel-x") as HTMLElement;
      if (titleEl) titleEl.textContent = options.title || "Tags";
      if (subtitleEl) {
        subtitleEl.textContent = options.selectionCount != null
          ? `${options.selectionCount} bookmark${options.selectionCount !== 1 ? "s" : ""} selected`
          : "";
      }
      if (okBtn) okBtn.textContent = options.confirmText || "Apply";
      if (cancelBtn) cancelBtn.textContent = options.cancelText || "Cancel";

      this.renderSelectedTags();

      const input = this.modalElement.querySelector("#bulk-tags-text-input") as HTMLInputElement;
      const autocomplete = this.modalElement.querySelector("#bulk-tag-autocomplete") as HTMLElement;
      const container = this.modalElement.querySelector("#bulk-tags-input-container") as HTMLElement;
      if (input) input.value = "";

      const cleanup = () => {
        this.modalElement?.classList.add("hidden");
        okBtn?.removeEventListener("click", onConfirm);
        cancelBtn?.removeEventListener("click", onCancel);
        cancelXBtn?.removeEventListener("click", onCancel);
        backdrop?.removeEventListener("click", onCancel);
        input?.removeEventListener("input", onInput);
        input?.removeEventListener("keydown", onInputKeydown);
        input?.removeEventListener("focus", onFocus);
        container?.removeEventListener("click", onContainerClick);
        if (this.handleGlobalKeydown) {
          window.removeEventListener("keydown", this.handleGlobalKeydown);
          this.handleGlobalKeydown = null;
        }
        if (this.handleClickOutside) {
          document.removeEventListener("click", this.handleClickOutside);
          this.handleClickOutside = null;
        }
      };

      const onConfirm = () => {
        if (input?.value.trim()) this.addTag(input.value.trim());
        const result = [...this.selectedTags];
        cleanup();
        resolve(result.length > 0 ? result : null);
      };

      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      const onInput = (e: Event) => {
        this.showAutocomplete((e.target as HTMLInputElement).value.trim(), autocomplete);
      };

      const onFocus = () => {
        this.showAutocomplete(input?.value.trim() || "", autocomplete);
      };

      const onContainerClick = () => input?.focus();

      const onInputKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const activeItem = autocomplete.querySelector(".tag-autocomplete-item.active");
          if (activeItem) {
            this.addTag((activeItem as HTMLElement).dataset.tag || "");
          } else if (input.value.trim()) {
            this.addTag(input.value.trim());
          }
        } else if (e.key === "Backspace" && input.value === "" && this.selectedTags.length > 0) {
          this.removeTag(this.selectedTags[this.selectedTags.length - 1]);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.navigateAutocomplete(1, autocomplete);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this.navigateAutocomplete(-1, autocomplete);
        } else if (e.key === "Escape") {
          if (autocomplete.style.display !== "none") {
            this.hideAutocomplete(autocomplete);
          } else {
            onCancel();
          }
        } else if (e.key === "," || e.key === "Tab") {
          e.preventDefault();
          if (input.value.trim()) this.addTag(input.value.trim());
        }
      };

      okBtn?.addEventListener("click", onConfirm);
      cancelBtn?.addEventListener("click", onCancel);
      cancelXBtn?.addEventListener("click", onCancel);
      input?.addEventListener("input", onInput);
      input?.addEventListener("keydown", onInputKeydown);
      input?.addEventListener("focus", onFocus);
      container?.addEventListener("click", onContainerClick);

      const backdrop = this.modalElement.querySelector(".modal-backdrop");
      backdrop?.addEventListener("click", onCancel);

      this.handleGlobalKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      };
      window.addEventListener("keydown", this.handleGlobalKeydown);

      this.handleClickOutside = (e: Event) => {
        if (
          !container?.contains(e.target as Node) &&
          !autocomplete?.contains(e.target as Node)
        ) {
          this.hideAutocomplete(autocomplete);
        }
      };
      document.addEventListener("click", this.handleClickOutside);

      this.modalElement.classList.remove("hidden");
      setTimeout(() => {
        input?.focus();
        this.showAutocomplete("", autocomplete);
      }, 50);
    });
  }
}

export const tagPickerDialog = (options?: TagPickerOptions) =>
  TagPickerDialog.getInstance().show(options);
