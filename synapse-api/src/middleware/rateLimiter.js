const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

// A shared handler so every limiter returns the same predictable
// 429 shape as the rest of the API, instead of express-rate-limit's
// default plain-text response.
function rateLimitHandler(req, res, next) {
  next(ApiError.tooManyRequests('Too many requests. Please wait a moment and try again.'));
}

// General limiter — applied to the whole API as a baseline defense
// against abuse (the "circuit breaker" for the system as a whole).
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Stricter limiter for auth endpoints specifically — login/register
// are the most common target for brute-force and credential-stuffing
// attacks, so they get a tighter, separate budget.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = { generalLimiter, authLimiter };
