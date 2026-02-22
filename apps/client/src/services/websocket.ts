/**
 * WebSocket Service
 * Provides a reconnecting WebSocket client for real-time server notifications.
 *
 * Events received from server:
 *   - bookmarks:changed  → triggers bookmark list refresh
 *   - folders:changed    → triggers folder tree refresh
 *   - tags:changed       → triggers tag list refresh
 *
 * Authentication is handled automatically via the httpOnly JWT cookie —
 * the browser includes cookies on the WebSocket upgrade request.
 */

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000; // Start at 1s, exponential backoff
const MAX_RECONNECT_DELAY = 30000;
let intentionalClose = false;

// Debounce rapid events to avoid UI thrashing during bulk operations
let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_MS = 500;

/**
 * Connect to the WebSocket server.
 * Call this after login — auth is via the httpOnly cookie, no token needed.
 */
export function connectWebSocket(): void {
  if (
    ws &&
    (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
  ) {
    return; // Already connected or connecting
  }

  intentionalClose = false;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  try {
    ws = new WebSocket(wsUrl);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectDelay = 1000; // Reset backoff on successful connect
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleEvent(data);
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    ws = null;
    if (!intentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    // Error will trigger onclose, which handles reconnection
  };
}

/**
 * Disconnect from the WebSocket server.
 * Call this on logout.
 */
export function disconnectWebSocket(): void {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  // Clear all debounce timers
  for (const key of Object.keys(debounceTimers)) {
    clearTimeout(debounceTimers[key]);
  }
  debounceTimers = {};

  if (ws) {
    ws.close();
    ws = null;
  }
}

/**
 * Schedule a reconnection with exponential backoff.
 */
function scheduleReconnect(): void {
  if (intentionalClose) return;
  if (reconnectTimer) return; // Already scheduled

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connectWebSocket();
  }, reconnectDelay);
}

/**
 * Handle incoming WebSocket events.
 * Debounces rapid successive events of the same type.
 */
function handleEvent(data: { type: string; payload?: unknown }): void {
  const { type } = data;

  // Skip connected confirmation
  if (type === "connected") return;

  // Debounce: if we get multiple events of the same type quickly, only act once
  if (debounceTimers[type]) {
    clearTimeout(debounceTimers[type]);
  }

  debounceTimers[type] = setTimeout(async () => {
    delete debounceTimers[type];

    switch (type) {
      case "bookmarks:changed":
        try {
          const { loadBookmarks } =
            await import("@features/bookmarks/bookmarks.ts");
          await loadBookmarks();
        } catch {
          // Silently fail - user can manually refresh
        }
        break;

      case "folders:changed":
        try {
          const { loadFolders } =
            await import("@features/bookmarks/folders.ts");
          await loadFolders();
        } catch {
          // Silently fail
        }
        break;

      case "tags:changed":
        try {
          const { loadBookmarks } =
            await import("@features/bookmarks/bookmarks.ts");
          await loadBookmarks();
        } catch {
          // Silently fail
        }
        break;

      default:
        break;
    }
  }, DEBOUNCE_MS);
}

/**
 * Check if the WebSocket is currently connected.
 */
export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
