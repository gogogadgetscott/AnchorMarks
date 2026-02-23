/**
 * Centralized server logger.
 * - Respects NODE_ENV: verbose in development/test, minimal in production.
 * - In production, errors are always logged; debug/info only when LOG_LEVEL allows.
 * - Optional JSON output for production (LOG_JSON=true) for log aggregation.
 */

const config = require("../config");

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const envLevel =
  LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ??
  (config.NODE_ENV === "development" || config.NODE_ENV === "test" ? 0 : 1);
const useJson = process.env.LOG_JSON === "true";

function shouldLog(level) {
  return LOG_LEVELS[level] >= envLevel;
}

function formatEntry(level, message, meta = {}) {
  const ts = new Date().toISOString();
  if (useJson) {
    return JSON.stringify({
      time: ts,
      level,
      msg: message,
      ...meta,
    });
  }
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
}

function serializeError(err) {
  if (!err) return undefined;
  const o = {
    name: err.name,
    message: err.message,
    code: err.code,
  };
  if (config.NODE_ENV !== "production" && err.stack) {
    o.stack = err.stack;
  }
  return o;
}

const logger = {
  debug(message, ...args) {
    if (!shouldLog("debug")) return;
    const meta = args.length
      ? args[0] && typeof args[0] === "object" && !(args[0] instanceof Error)
        ? args[0]
        : { extra: args }
      : {};
    const out = formatEntry("debug", message, meta);
    console.debug(out);
  },

  info(message, ...args) {
    if (!shouldLog("info")) return;
    const meta = args.length
      ? args[0] && typeof args[0] === "object" && !(args[0] instanceof Error)
        ? args[0]
        : { extra: args }
      : {};
    const out = formatEntry("info", message, meta);
    console.info(out);
  },

  warn(message, ...args) {
    if (!shouldLog("warn")) return;
    const err = args.find((a) => a instanceof Error);
    const meta = err
      ? { err: serializeError(err) }
      : args[0] && typeof args[0] === "object"
        ? args[0]
        : { extra: args };
    const out = formatEntry("warn", message, meta);
    console.warn(out);
    if (err && !useJson) console.warn(err.stack);
  },

  error(message, errOrMeta, ...args) {
    if (!shouldLog("error")) return;
    const err = errOrMeta instanceof Error ? errOrMeta : null;
    const meta =
      err !== null
        ? { err: serializeError(err), extra: args.length ? args : undefined }
        : errOrMeta && typeof errOrMeta === "object" && errOrMeta !== null
          ? { ...errOrMeta, extra: args.length ? args : undefined }
          : { extra: args.length ? [errOrMeta, ...args] : [errOrMeta] };
    const out = formatEntry("error", message, meta);
    console.error(out);
    if (err && !useJson && err.stack) console.error(err.stack);
  },
};

module.exports = { logger, serializeError };
