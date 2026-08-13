const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Sits after a chain of express-validator checks on a route. If any of
// them failed, this collects all the failures into one clear 400
// response instead of stopping at the first problem — better DX for
// whoever is calling the API, since they see every issue at once.
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  next(ApiError.badRequest('Validation failed.', details));
}

module.exports = validate;
