const AuthService = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, token } = await AuthService.register({ name, email, password });
  res.status(201).json({ data: { user, token } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await AuthService.login({ email, password });
  res.status(200).json({ data: { user, token } });
});

module.exports = { register, login };
