import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@contexts/AuthContext";

interface UseWebSocketReturn {
  isConnected: boolean;
  reconnect: () => void;
}

const MAX_RECONNECT_DELAY = 30000;
const DEBOUNCE_MS = 500;

export function useWebSocket(): UseWebSocketReturn {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const intentionalCloseRef = useRef(false);
  const debounceTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    intentionalCloseRef.current = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      wsRef.current = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }

    wsRef.current.onopen = () => {
      reconnectDelayRef.current = 1000;
      setIsConnected(true);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current.onclose = () => {
      wsRef.current = null;
      setIsConnected(false);
      if (!intentionalCloseRef.current) {
        scheduleReconnect();
      }
    };

    wsRef.current.onerror = () => {
      // Error will trigger onclose, which handles reconnection
    };
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    for (const key of Object.keys(debounceTimersRef.current)) {
      clearTimeout(debounceTimersRef.current[key]);
    }
    debounceTimersRef.current = {};

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalCloseRef.current) return;
    if (reconnectTimerRef.current) return;

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY,
      );
      connect();
    }, reconnectDelayRef.current);
  }, [connect]);

  const handleEvent = useCallback(
    async (data: { type: string; payload?: unknown }) => {
      const { type } = data;

      if (type === "connected") return;

      if (debounceTimersRef.current[type]) {
        clearTimeout(debounceTimersRef.current[type]);
      }

      debounceTimersRef.current[type] = setTimeout(async () => {
        delete debounceTimersRef.current[type];

        switch (type) {
          case "bookmarks:changed":
            try {
              const { loadBookmarks } =
                await import("@features/bookmarks/bookmarks.ts");
              await loadBookmarks();
            } catch {
              // Silently fail
            }
            break;

          case "folders:changed":
            try {
              const { getFoldersBridge } =
                await import("@/contexts/context-bridge");
              await getFoldersBridge().loadFolders();
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
        }
      }, DEBOUNCE_MS);
    },
    [],
  );

  const reconnect = useCallback(() => {
    disconnect();
    reconnectDelayRef.current = 1000;
    setTimeout(() => {
      if (mountedRef.current && isAuthenticated) {
        connect();
      }
    }, 100);
  }, [connect, disconnect, isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;

    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  return {
    isConnected,
    reconnect,
  };
}
