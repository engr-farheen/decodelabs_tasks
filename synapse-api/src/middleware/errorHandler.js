const ApiError = require('../utils/ApiError');

// 404 handler — reached only if no route matched above it.
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

// Central error handler. Express recognizes this as an error handler
// specifically because it takes 4 arguments (err, req, res, next).
// Every ApiError thrown anywhere in the app (sync or async, thanks to
// the asyncHandler wrapper) ends up here exactly once.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isKnownError = err instanceof ApiError;
  const statusCode = isKnownError ? err.statusCode : 500;

  // Never leak internals (stack traces, raw DB errors) for unexpected
  // failures — log them server-side, return a safe generic message.
  if (!isKnownError) {
    console.error('Unexpected error:', err);
  }

  res.status(statusCode).json({
    error: {
      message: isKnownError ? err.message : 'Internal server error.',
      ...(isKnownError && err.details ? { details: err.details } : {}),
    },
  });
}

// Wraps an async route handler so any rejected promise is forwarded to
// next(err) automatically — without this, a thrown error inside an
// async function would crash the process instead of being handled.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFoundHandler, errorHandler, asyncHandler };
