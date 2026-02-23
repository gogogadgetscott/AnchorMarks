require("dotenv").config({ quiet: true });
const path = require("path");

const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const SSL_KEY = process.env.SSL_KEY || null;
const SSL_CERT = process.env.SSL_CERT || null;
const fs = require("fs");
const SSL_ENABLED =
  process.env.SSL_ENABLED === "true" &&
  SSL_KEY &&
  SSL_CERT &&
  fs.existsSync(SSL_KEY) &&
  fs.existsSync(SSL_CERT);
const crypto = require("crypto");

const INSECURE_SECRETS = [
  "change-this-to-a-secure-secret",
  "your-super-secret-jwt-key-change-this-to-a-random-string",
];

function validateSecurityConfig() {
  const env = process.env.NODE_ENV || "development";
  if (env !== "production") {
    if (!process.env.JWT_SECRET) {
      console.warn(
        "WARNING: JWT_SECRET not set. Using a random secret (sessions will be invalidated on restart).",
      );
    }
    return;
  }

  if (
    !process.env.JWT_SECRET ||
    INSECURE_SECRETS.includes(process.env.JWT_SECRET)
  ) {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }

  if (!process.env.CORS_ORIGIN) {
    throw new Error("CORS_ORIGIN must be configured in production");
  }
}

function resolveCorsOrigin() {
  const env = process.env.NODE_ENV || "development";
  if (env !== "production") return true;

  const origin = (process.env.CORS_ORIGIN || "").trim();
  if (!origin) {
    throw new Error("CORS_ORIGIN must be configured in production");
  }
  if (origin === "*") {
    throw new Error("CORS_ORIGIN cannot be * in production");
  }
  const origins = origin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must contain at least one valid origin");
  }
  return origins;
}

const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex");
// Short-lived access token; refresh token rotation extends sessions (defaults: 15m access, 7d refresh)
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";
// Resolve DB_PATH so relative paths (e.g. ./apps/database/anchormarks.db) are
// relative to project root, not process cwd (fixes Docker when cwd is /apps/server).
const projectRoot = path.join(__dirname, "..", "..", "..");
const defaultDbPath = path.join(
  __dirname,
  "..",
  "..",
  "database",
  "anchormarks.db",
);
const rawDbPath = process.env.DB_PATH || defaultDbPath;
const DB_PATH = path.isAbsolute(rawDbPath)
  ? path.normalize(rawDbPath)
  : path.resolve(projectRoot, rawDbPath);
const ENABLE_BACKGROUND_JOBS = NODE_ENV !== "test";
const ENABLE_FAVICON_BACKGROUND_JOBS = false; // Only fetch favicons on import/save

// Thumbnail screenshot configuration
const THUMBNAIL_ENABLED = process.env.THUMBNAIL_ENABLED === "true";
const THUMBNAIL_WIDTH = parseInt(process.env.THUMBNAIL_WIDTH) || 1280;
const THUMBNAIL_HEIGHT = parseInt(process.env.THUMBNAIL_HEIGHT) || 800;
const THUMBNAIL_QUALITY = parseInt(process.env.THUMBNAIL_QUALITY) || 80;
const THUMBNAIL_TIMEOUT = parseInt(process.env.THUMBNAIL_TIMEOUT) || 15000;

// Optional AI tag suggestion configuration
const AI_PROVIDER = (process.env.AI_PROVIDER || "none").toLowerCase();
const AI_MODEL = process.env.AI_MODEL || null;
const AI_API_URL = process.env.AI_API_URL || null; // e.g., https://api.openai.com/v1
const AI_API_KEY = process.env.AI_API_KEY || null;

// API key scope whitelist (method + path regex)
const API_KEY_WHITELIST = [
  // Bookmarks sync endpoints
  { method: "GET", path: /^\/api\/bookmarks(\/.*)?$/ },
  { method: "POST", path: /^\/api\/bookmarks(\/.*)?$/ },
  { method: "PUT", path: /^\/api\/bookmarks(\/.*)?$/ },
  { method: "DELETE", path: /^\/api\/bookmarks(\/.*)?$/ },
  // Folders sync endpoints
  { method: "GET", path: /^\/api\/folders(\/.*)?$/ },
  { method: "POST", path: /^\/api\/folders(\/.*)?$/ },
  { method: "PUT", path: /^\/api\/folders(\/.*)?$/ },
  { method: "DELETE", path: /^\/api\/folders(\/.*)?$/ },
  // Sync endpoints
  { method: "GET", path: /^\/api\/sync(\/.*)?$/ },
  // Quick search
  { method: "GET", path: /^\/api\/quick-search/ },
];

function isApiKeyAllowed(req) {
  return API_KEY_WHITELIST.some(
    (rule) => rule.method === req.method && rule.path.test(req.path),
  );
}

function getAIConfig() {
  return {
    provider: AI_PROVIDER,
    model: AI_MODEL,
    apiUrl: AI_API_URL,
    apiKey: AI_API_KEY,
  };
}

module.exports = {
  NODE_ENV,
  PORT,
  HOST,
  SSL_KEY,
  SSL_CERT,
  SSL_ENABLED,
  JWT_SECRET,
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  DB_PATH,
  ENABLE_BACKGROUND_JOBS,
  ENABLE_FAVICON_BACKGROUND_JOBS,
  THUMBNAIL_ENABLED,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_TIMEOUT,
  validateSecurityConfig,
  resolveCorsOrigin,
  isApiKeyAllowed,
  getAIConfig,
};
