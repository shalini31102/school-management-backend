// utils/asyncHandler.js
/**
 * Wraps async route handlers so every thrown error is forwarded to Express's
 * error-handler middleware — no try/catch boilerplate needed in controllers.
 *
 * Usage:
 *   const asyncHandler = require('../utils/asyncHandler');
 *   const getStudents = asyncHandler(async (req, res) => { ... });
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
