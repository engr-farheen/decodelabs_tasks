// A predictable error shape that maps directly to an HTTP status code.
// Anywhere in the app that needs to fail, it throws one of these —
// the central error handler (see middleware/errorHandler.js) knows
// how to turn it into the right response.
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // distinguishes "expected" errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) { return new ApiError(400, message, details); }
  static unauthorized(message = 'Authentication required.') { return new ApiError(401, message); }
  static forbidden(message = 'You do not have permission to do that.') { return new ApiError(403, message); }
  static notFound(message = 'Resource not found.') { return new ApiError(404, message); }
  static conflict(message) { return new ApiError(409, message); }
  static tooManyRequests(message = 'Too many requests. Please slow down.') { return new ApiError(429, message); }
  static internal(message = 'Something went wrong on our end.') { return new ApiError(500, message); }
}

module.exports = ApiError;
