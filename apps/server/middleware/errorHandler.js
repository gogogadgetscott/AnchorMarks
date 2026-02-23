/**
 * Centralized error-handling middleware.
 * - Logs every error via server logger (with request context).
 * - Responds with consistent JSON { error } and no stack in production.
 * - Expects errors to be passed with next(err); optional AppError or normalizeError shape.
 */

const { logger } = require("../lib/logger");
const { normalizeError } = require("../lib/errors");

function errorHandler(err, req, res, _next) {
  const normalized = normalizeError(err);
  const { statusCode, clientMessage } = normalized;

  logger.error("Unhandled error", normalized.err, {
    statusCode,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({ error: clientMessage });
}

/**
 * Wraps async route handlers so rejections are passed to the central error handler.
 * @example router.get("/", asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
