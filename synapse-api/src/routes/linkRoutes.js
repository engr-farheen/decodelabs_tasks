const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const {
  createLink,
  listLinks,
  getLink,
  replaceLink,
  updateLink,
  deleteLink,
  getAnalytics,
} = require('../controllers/linkController');

const router = Router();

const urlValidator = body('url')
  .isURL({ require_protocol: true })
  .withMessage('A valid URL including http(s):// is required.');

const idParamValidator = param('id').isInt({ min: 1 }).withMessage('Link id must be a positive integer.');

/**
 * @openapi
 * /api/links:
 *   post:
 *     summary: Shorten a new URL
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url: { type: string, example: "https://example.com/a/very/long/path" }
 *               customAlias: { type: string, example: "my-link" }
 *               expiresInDays: { type: integer, example: 30, description: "Optional — link stops resolving after this many days" }
 *     responses:
 *       201: { description: Link created }
 *       400: { description: Validation failed }
 *       401: { description: Missing or invalid token }
 *       409: { description: Custom alias already taken }
 */
router.post(
  '/',
  requireAuth,
  [
    urlValidator,
    body('customAlias').optional().trim().isLength({ min: 3, max: 30 }),
    body('expiresInDays').optional().isInt({ min: 1, max: 3650 }).withMessage('expiresInDays must be between 1 and 3650.'),
  ],
  validate,
  createLink
);

/**
 * @openapi
 * /api/links:
 *   get:
 *     summary: List your links (paginated)
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: A page of links }
 *       401: { description: Missing or invalid token }
 */
router.get(
  '/',
  requireAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  listLinks
);

/**
 * @openapi
 * /api/links/{id}:
 *   get:
 *     summary: Get a single link by id
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Link found }
 *       403: { description: You do not own this link }
 *       404: { description: Link not found }
 */
router.get('/:id', requireAuth, [idParamValidator], validate, getLink);

/**
 * @openapi
 * /api/links/{id}:
 *   put:
 *     summary: Replace a link entirely (full update)
 *     description: >
 *       Full replacement, not a partial update — the destination URL is required.
 *       The link's active state is reset to true, since PUT means "this is now
 *       the whole resource," not "change just these fields" (that's PATCH, below).
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url: { type: string, example: "https://example.com/new-destination" }
 *     responses:
 *       200: { description: Link replaced }
 *       400: { description: Validation failed }
 *       403: { description: You do not own this link }
 *       404: { description: Link not found }
 */
router.put(
  '/:id',
  requireAuth,
  [idParamValidator, body('url').isURL({ require_protocol: true }).withMessage('A valid URL is required for a full replacement.')],
  validate,
  replaceLink
);

/**
 * @openapi
 * /api/links/{id}:
 *   patch:
 *     summary: Partially update a link's destination or active state
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Link updated }
 *       403: { description: You do not own this link }
 *       404: { description: Link not found }
 */
router.patch(
  '/:id',
  requireAuth,
  [
    idParamValidator,
    body('url').optional().isURL({ require_protocol: true }),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  updateLink
);

/**
 * @openapi
 * /api/links/{id}:
 *   delete:
 *     summary: Delete a link
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Link deleted }
 *       403: { description: You do not own this link }
 *       404: { description: Link not found }
 */
router.delete('/:id', requireAuth, [idParamValidator], validate, deleteLink);

/**
 * @openapi
 * /api/links/{id}/analytics:
 *   get:
 *     summary: Get click analytics for a link
 *     tags: [Links]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Analytics for the link }
 *       403: { description: You do not own this link }
 *       404: { description: Link not found }
 */
router.get('/:id/analytics', requireAuth, [idParamValidator], validate, getAnalytics);

module.exports = router;
