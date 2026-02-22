/**
 * WebSocket Manager
 * Provides real-time push notifications to connected clients.
 *
 * Usage:
 *   const { initWebSocket, broadcast } = require("./helpers/websocket");
 *   initWebSocket(httpServer);                // once at startup
 *   broadcast(userId, { type: "bookmarks:changed" });  // after any mutation
 */

const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const config = require("../config");
const url = require("url");

// userId → Set<WebSocket>
const clients = new Map();

// Heartbeat interval (30s)
const HEARTBEAT_INTERVAL_MS = 30000;

let wss = null;
let heartbeatTimer = null;

/**
 * Parse cookies from a raw Cookie header string.
 * @param {string} cookieHeader - The raw Cookie header value
 * @returns {Object} key-value pairs of cookies
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
    }
  });
  return cookies;
}

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Clients connect to ws(s)://<host>/ws — auth is via the httpOnly JWT cookie.
 */
function initWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade requests for the /ws path
  server.on("upgrade", (request, socket, head) => {
    const { pathname } = url.parse(request.url, true);

    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    // Authenticate via the httpOnly JWT cookie
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies.token;

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      request._wsUserId = decoded.userId || decoded.id;
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, request) => {
    const userId = request._wsUserId;
    if (!userId) {
      ws.close(1008, "Missing user identity");
      return;
    }

    // Track connection
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    // Mark alive for heartbeat
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Confirm connection with the client
    ws.send(JSON.stringify({ type: "connected", payload: { userId } }));

    ws.on("close", () => {
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          clients.delete(userId);
        }
      }
    });

    ws.on("error", () => {
      // Errors are handled by the close event
    });
  });

  // Heartbeat: ping every 30s, terminate unresponsive connections
  heartbeatTimer = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeatTimer);
  });

  return wss;
}

/**
 * Broadcast an event to all of a user's connected WebSocket clients.
 * @param {string} userId - The user to notify
 * @param {{ type: string, payload?: any }} event - The event to send
 */
function broadcast(userId, event) {
  if (!clients.has(userId)) return;

  const message = JSON.stringify(event);
  const userClients = clients.get(userId);

  for (const ws of userClients) {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(message);
    }
  }
}

/**
 * Get the count of active WebSocket connections (for health/metrics).
 */
function getConnectionCount() {
  let total = 0;
  for (const set of clients.values()) {
    total += set.size;
  }
  return total;
}

module.exports = { initWebSocket, broadcast, getConnectionCount };
