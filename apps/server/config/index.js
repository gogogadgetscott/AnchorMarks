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
const DEFAULT_JWT_SECRET = "anchormarks-secret-key-change-in-production";
const INSECURE_SECRETS = [
  DEFAULT_JWT_SECRET,
  "change-this-to-a-secure-secret",
  "your-super-secret-jwt-key-change-this-to-a-random-string",
];

function validateSecurityConfig() {
  const env = process.env.NODE_ENV || "development";
  if (env !== "production") return;

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

  const origin = process.env.CORS_ORIGIN;
  if (origin.trim() === "*") {
    throw new Error("CORS_ORIGIN cannot be * in production");
  }
  return origin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const DB_PATH =
  process.env.DB_PATH || path.join(__dirname, "../../database/anchormarks.db");
const ENABLE_BACKGROUND_JOBS = NODE_ENV !== "test";
const ENABLE_FAVICON_BACKGROUND_JOBS = false; // Only fetch favicons on import/save

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
  DB_PATH,
  ENABLE_BACKGROUND_JOBS,
  ENABLE_FAVICON_BACKGROUND_JOBS,
  validateSecurityConfig,
  resolveCorsOrigin,
  isApiKeyAllowed,
  getAIConfig,
};
