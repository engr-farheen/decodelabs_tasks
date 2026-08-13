const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

// AuthN: confirms *who* is making the request. Any route using this
// middleware requires a valid "Authorization: Bearer <token>" header.
// Stateless by design — the server holds no session; every request
// carries everything needed to verify identity, which is what lets
// this API scale horizontally without shared session storage.
function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header.'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Your session has expired. Please log in again.'));
    }
    return next(ApiError.unauthorized('Invalid authentication token.'));
  }
}

module.exports = { requireAuth };
