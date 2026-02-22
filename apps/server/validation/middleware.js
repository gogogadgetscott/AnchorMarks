"use strict";

/**
 * Validates req.body against a Zod schema. On success sets req.validated and calls next().
 * On failure responds with 400 and the first validation error message.
 * @param {import("zod").ZodType} schema - Zod schema (object type)
 * @returns {import("express").RequestHandler}
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.validated = result.data;
      return next();
    }
    const first = result.error.errors[0];
    const message = first?.message || "Validation failed";
    return res.status(400).json({ error: message });
  };
}

/**
 * Validates req.query against a Zod schema. On success sets req.validatedQuery and calls next().
 * On failure responds with 400 and the first validation error message.
 * @param {import("zod").ZodType} schema - Zod schema (object type)
 * @returns {import("express").RequestHandler}
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (result.success) {
      req.validatedQuery = result.data;
      return next();
    }
    const first = result.error.errors[0];
    const message = first?.message || "Invalid query parameters";
    return res.status(400).json({ error: message });
  };
}

module.exports = { validateBody, validateQuery };
