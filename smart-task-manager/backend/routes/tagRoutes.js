const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createTag, getTags, deleteTag } = require('../controllers/tagController');

router.use(protect);

/**
 * @openapi
 * /tags:
 *   get:
 *     tags: [Tags]
 *     summary: List the current user's tags
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of tags }
 *   post:
 *     tags: [Tags]
 *     summary: Create a tag
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201: { description: Tag created }
 *       409: { description: Tag name already exists for this user }
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Tag name is required')
      .isLength({ max: 24 }).withMessage('Tag name cannot exceed 24 characters'),
  ],
  validate,
  createTag
);
router.get('/', getTags);

/**
 * @openapi
 * /tags/{id}:
 *   delete:
 *     tags: [Tags]
 *     summary: Delete a tag (also removes it from every task that used it)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tag deleted }
 *       404: { description: Tag not found }
 */
router.delete('/:id', deleteTag);

module.exports = router;
