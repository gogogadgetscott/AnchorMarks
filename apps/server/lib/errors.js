/**
 * Centralized error types and normalization for consistent handling.
 * - Use AppError for known HTTP errors (status + safe client message).
 * - Use normalizeError() to turn any thrown value into { status, clientMessage, err }.
 */

const config = require("../config");

/**
 * Application error with HTTP status and safe client-facing message.
 * In production, only message is sent to the client; stack stays server-side.
 */
class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.clientMessage =
      options.clientMessage ??
      (config.NODE_ENV === "production" ? "Internal Server Error" : message);
    this.code = options.code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Normalize any thrown value into a consistent shape for logging and response.
 * @param {unknown} err - Caught value (Error, string, etc.)
 * @returns {{ statusCode: number, clientMessage: string, err: Error }}
 */
function normalizeError(err) {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      clientMessage: err.clientMessage,
      err,
    };
  }
  const error = err instanceof Error ? err : new Error(String(err));
  // Support Express convention (err.status) and our AppError
  let statusCode = err?.status ?? err?.statusCode ?? 500;
  let clientMessage = err?.clientMessage ?? "Internal Server Error";

  if (error.name === "TokenExpiredError") {
    statusCode = 401;
    clientMessage = "Access token expired";
  } else if (error.name === "JsonWebTokenError") {
    statusCode = 403;
    clientMessage = "Invalid token";
  } else if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    statusCode = 409;
    clientMessage = error.message?.includes("user")
      ? "User already exists"
      : "Resource already exists";
  } else if (error.message && /UNIQUE|constraint/i.test(error.message)) {
    statusCode = 409;
    clientMessage = "Resource already exists";
  }
  if (
    clientMessage === "Internal Server Error" &&
    config.NODE_ENV !== "production" &&
    error.message
  ) {
    clientMessage = error.message;
  }

  return { statusCode, clientMessage, err: error };
}

/**
 * Send a normalized error response and return true so callers can "return sendError(...)".
 * Logs via the provided logger (e.g. server lib/logger).
 */
function sendError(res, normalized, log, context = "Request") {
  const { statusCode, clientMessage, err } = normalized;
  if (log && log.error) {
    log.error(`${context}: ${clientMessage}`, err, { statusCode });
  }
  res.status(statusCode).json({ error: clientMessage });
  return true;
}

/**
 * Normalize, log, and send error in one call. Use in route catch blocks.
 * @example catch (err) { return reportAndSend(res, err, logger, "Error listing bookmarks"); }
 */
function reportAndSend(res, err, log, context = "Request") {
  return sendError(res, normalizeError(err), log, context);
}

module.exports = {
  AppError,
  normalizeError,
  sendError,
  reportAndSend,
};
