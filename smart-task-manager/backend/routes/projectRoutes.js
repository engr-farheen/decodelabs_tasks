const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');

router.use(protect); // every project route requires a logged-in user

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List the current user's projects
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of projects with task counts }
 *   post:
 *     tags: [Projects]
 *     summary: Create a project
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
 *               description: { type: string }
 *     responses:
 *       201: { description: Project created }
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Project name is required')
      .isLength({ max: 40 }).withMessage('Project name cannot exceed 40 characters'),
    body('description').optional({ nullable: true }).isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),
  ],
  validate,
  createProject
);
router.get('/', getProjects);

/**
 * @openapi
 * /projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a single project
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project found }
 *       404: { description: Project not found }
 *   put:
 *     tags: [Projects]
 *     summary: Update a project
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project updated }
 *       404: { description: Project not found }
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project (and its tasks)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Project deleted }
 *       404: { description: Project not found }
 */
router.get('/:id', getProjectById);
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty')
      .isLength({ max: 40 }).withMessage('Project name cannot exceed 40 characters'),
    body('description').optional({ nullable: true }).isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),
  ],
  validate,
  updateProject
);
router.delete('/:id', deleteProject);

module.exports = router;
