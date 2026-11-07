/**
 * WebSocket upgrade hardening tests.
 *
 * The upgrade listener used to run unguarded: a malformed cookie percent
 * sequence threw a URIError out of the listener, and a bad request URL threw
 * from `new URL(...)` — in both cases an uncaught exception that killed the
 * whole server process. Both paths must now reject the handshake instead.
 */
const { EventEmitter } = require("events");
const jwt = require("jsonwebtoken");
const { initWebSocket } = require("../services/websocketService");
const config = require("../config");

function makeSocket() {
  const socket = {
    written: [],
    destroyed: false,
    write(chunk) {
      socket.written.push(String(chunk));
    },
    destroy() {
      socket.destroyed = true;
    },
  };
  return socket;
}

function emitUpgrade(request) {
  const socket = makeSocket();
  const head = Buffer.alloc(0);
  server.emit("upgrade", request, socket, head);
  return socket;
}

const cookieName = `${config.COOKIE_PREFIX}token`;

let server;
let wss;

beforeAll(() => {
  // One server for the whole suite: initWebSocket starts a heartbeat interval
  // that is only cleared when the wss closes, so init once and close once.
  server = new EventEmitter();
  wss = initWebSocket(server, null);
});

afterAll(() => {
  if (wss) wss.close();
});

describe("WebSocket upgrade robustness", () => {
  it("rejects with 401 instead of crashing on a malformed percent-encoded cookie", () => {
    // decodeURIComponent("%zz") throws URIError — parseCookies must fall back
    // to the raw value, and jwt.verify must then reject it cleanly.
    let socket;
    expect(() => {
      socket = emitUpgrade({
        url: "/ws",
        headers: { cookie: `${cookieName}=%zz` },
      });
    }).not.toThrow();

    expect(socket.written.join("")).toContain("401");
    expect(socket.destroyed).toBe(true);
  });

  it("rejects with 400 instead of crashing on an unparseable request URL", () => {
    // new URL("http://dummy%") throws "Invalid URL"
    let socket;
    expect(() => {
      socket = emitUpgrade({ url: "%", headers: {} });
    }).not.toThrow();

    expect(socket.written.join("")).toContain("400");
    expect(socket.destroyed).toBe(true);
  });

  it("rejects with 401 when no session cookie is present", () => {
    const socket = emitUpgrade({ url: "/ws", headers: {} });
    expect(socket.written.join("")).toContain("401");
  });

  it("rejects with 401 when the session cookie is not a valid JWT", () => {
    const socket = emitUpgrade({
      url: "/ws",
      headers: { cookie: `${cookieName}=garbage.token.here` },
    });
    expect(socket.written.join("")).toContain("401");
  });

  it("destroys the socket for non-/ws paths without a handshake response", () => {
    const token = jwt.sign({ userId: "user-1" }, config.JWT_SECRET);
    const socket = emitUpgrade({
      url: "/not-ws",
      headers: { cookie: `${cookieName}=${token}` },
    });
    expect(socket.written).toHaveLength(0);
    expect(socket.destroyed).toBe(true);
  });
});
