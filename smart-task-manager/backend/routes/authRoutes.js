const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const validate = require('../middleware/validate');
const protect = require('../middleware/auth');
const { register, login, getMe } = require('../controllers/authController');

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Ada Lovelace }
 *               email: { type: string, example: ada@example.com }
 *               password: { type: string, example: secret123 }
 *     responses:
 *       201: { description: User created, returns a JWT token }
 *       400: { description: Validation error }
 *       409: { description: Email already registered }
 */
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('A valid email is required')
      .customSanitizer((value) => value.toLowerCase()),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  register
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful, returns a JWT token }
 *       401: { description: Invalid credentials }
 */
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('A valid email is required')
      .customSanitizer((value) => value.toLowerCase()),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user profile }
 *       401: { description: Not authorized }
 */
router.get('/me', protect, getMe);

module.exports = router;
