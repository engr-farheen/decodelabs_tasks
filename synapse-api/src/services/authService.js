const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 12;

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const AuthService = {
  async register({ name, email, password }) {
    const existing = UserModel.findByEmail(email);
    // Semantic validation: the request is well-formed, but the *business
    // rule* — "emails must be unique" — is what actually rejects it.
    if (existing) throw ApiError.conflict('An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = UserModel.create({ name, email, passwordHash });
    const token = issueToken(user);
    return { user, token };
  },

  async login({ email, password }) {
    const user = UserModel.findByEmail(email);
    // Deliberately the same error for "no such user" and "wrong password" —
    // revealing which one it was lets attackers enumerate valid emails.
    if (!user) throw ApiError.unauthorized('Invalid email or password.');

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) throw ApiError.unauthorized('Invalid email or password.');

    const token = issueToken(user);
    const { password_hash, ...safeUser } = user;
    return { user: safeUser, token };
  },
};

module.exports = AuthService;
