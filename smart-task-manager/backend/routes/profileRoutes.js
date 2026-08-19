const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const { getMyProfile, updateMyProfile } = require('../controllers/profileController');

router.use(protect);

/**
 * @openapi
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get the current user's profile (1:1 with User)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile found (auto-created if missing) }
 *   put:
 *     tags: [Profile]
 *     summary: Update the current user's profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio: { type: string }
 *               phone: { type: string }
 *               avatarUrl: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */
router.get('/', getMyProfile);
router.put(
  '/',
  [
    body('bio').optional({ nullable: true }).isLength({ max: 300 }).withMessage('Bio cannot exceed 300 characters'),
    body('phone').optional({ nullable: true }).isLength({ max: 30 }).withMessage('Phone is too long'),
    body('avatarUrl').optional({ nullable: true }).isLength({ max: 500 }).withMessage('Avatar URL is too long'),
  ],
  validate,
  updateMyProfile
);

module.exports = router;
