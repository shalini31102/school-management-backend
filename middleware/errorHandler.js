// middleware/errorHandler.js

/**
 * Central error-handler middleware.
 *
 * All errors forwarded via next(err) — including those from asyncHandler —
 * are processed here into a consistent JSON response.
 */
const errorHandler = (err, req, res, next) => {
  // Log in development; keep logs clean in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorHandler]', err);
  }

  let statusCode = err.statusCode || 500;
  let message    = err.message   || 'Server Error';

  // ── Mongoose: bad ObjectId ───────────────────────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 404;
    message    = `Resource not found (invalid id: ${err.value})`;
  }

  // ── Mongoose: duplicate key ──────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    statusCode = 400;
    message    = `${field} already exists`;
  }

  // ── Mongoose: validation error ───────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message    = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // ── JWT errors ───────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message    = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message    = 'Token expired. Please log in again.';
  }

  // ── Groq / external API errors ───────────────────────────────────────────
  if (err.name === 'GroqError' || err?.error?.type === 'invalid_request_error') {
    statusCode = 502;
    message    = 'AI service error. Please try again.';
  }

  const body = { success: false, message };

  // Attach stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

/**
 * 404 handler — must be registered AFTER all routes.
 */
const notFound = (req, res, next) => {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

module.exports = { errorHandler, notFound };
