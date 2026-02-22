/* eslint-disable @typescript-eslint/no-explicit-any */
/** Augment Window with runtime-attached properties used across AnchorMarks */
interface Window {
  AnchorMarks: Record<string, unknown>;
  showToast: (message: string, type?: string) => void;
  saveCurrentView: (() => void) | undefined;
  deleteView: ((id: string) => void) | undefined;
  restoreView: ((id: string) => void) | undefined;
  restoreBookmarkView: ((id: string) => Promise<void>) | undefined;
  _bookmarkScrollHandlerMap: WeakMap<Element, EventListener>;
  __tagCloudResizeCleanup: (() => void) | undefined;
  __eventCleanupDebug: Record<string, unknown>;
  __focusTrapDebug: Record<string, unknown>;
}

/** A Promise with an optional abort method, used by the API service for request cancellation */
interface AbortablePromise<T> extends Promise<T> {
  abort?: () => void;
}
