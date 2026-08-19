const { validationResult } = require('express-validator');

// Runs after express-validator's check() chains; short-circuits with 400
// and a clean list of field-level errors if any rule failed.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
