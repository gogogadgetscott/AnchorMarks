/**
 * Modal Controller - Bridge between old imperative API and new React modal system
 *
 * This module allows the old `openModal()` and `closeModal()` API to work with the
 * new React-based ModalContext. Instead of manipulating the DOM directly,
 * these functions dispatch state updates through a globally registered callback.
 *
 * Usage (existing code patterns continue to work):
 *   import { openModal, closeModal } from "@utils/modal-controller"
 *   openModal("bookmark-modal")
 *   closeModal()
 */

type ModalDispatcher = (action: ModalAction) => void;

interface ModalAction {
  type:
    | "open-bookmark"
    | "open-tag"
    | "open-folder"
    | "open-settings"
    | "open-filter"
    | "open-tour"
    | "close";
  payload?: any;
}

let dispatcher: ModalDispatcher | null = null;

/**
 * Register a modal dispatcher function (called by ModalContext on mount)
 */
export function registerModalDispatcher(fn: ModalDispatcher) {
  dispatcher = fn;
}

/**
 * Open bookmark modal
 * @param data Partial bookmark form data
 */
export function openBookmarkModal(data?: any) {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }
  dispatcher({
    type: "open-bookmark",
    payload: data,
  });
}

/**
 * Open tag modal.
 * Supports both legacy `(tagName, color)` and object input.
 */
export function openTagModal(
  tagOrName: { id?: string; name?: string; color?: string } | string,
  colorArg?: string,
) {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }

  const normalized =
    typeof tagOrName === "string"
      ? { name: tagOrName, color: colorArg }
      : tagOrName;

  const payload = {
    id: normalized.id,
    tagName: normalized.name ?? "",
    color: normalized.color ?? "#f59e0b",
  };

  dispatcher({
    type: "open-tag",
    payload,
  });
}

/**
 * Open folder modal
 * @param data Partial folder form data
 */
export function openFolderModal(data?: any) {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }
  dispatcher({
    type: "open-folder",
    payload: data,
  });
}

export function openSettingsModal(tab?: string) {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }
  dispatcher({
    type: "open-settings",
    payload: { tab },
  });
}

/**
 * Open filter sidebar
 */
export function openFilterModal() {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }
  dispatcher({
    type: "open-filter",
  });
}

/**
 * Open onboarding tour
 */
export function openTourModal() {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }
  dispatcher({
    type: "open-tour",
  });
}

/**
 * Close all modals
 */
export function closeModals() {
  if (!dispatcher) {
    console.warn(
      "Modal dispatcher not initialized. ModalProvider may not be mounted.",
    );
    return;
  }
  dispatcher({
    type: "close",
  });
}

/**
 * Legacy openModal API - maps string IDs to modal dispatcher calls
 * @param id Modal ID (e.g., "bookmark-modal", "settings-modal")
 * @deprecated Use openBookmarkModal, openSettingsModal, etc. instead
 */
export function openModal(id: string): void {
  switch (id) {
    case "bookmark-modal":
      openBookmarkModal();
      break;
    case "tag-modal":
      openTagModal("", "#f59e0b");
      break;
    case "folder-modal":
      openFolderModal();
      break;
    case "settings-modal":
      openSettingsModal("general");
      break;
    case "filter-sidebar":
      openFilterModal();
      break;
    case "tour":
      openTourModal();
      break;
    default:
      console.warn(`Unknown modal ID: ${id}`);
  }
}

/**
 * Legacy closeModal API - now just closes all modals
 * @deprecated Use closeModals() instead
 */
export function closeModal(): void {
  closeModals();
}
