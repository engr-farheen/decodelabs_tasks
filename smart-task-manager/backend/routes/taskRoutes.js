const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getDashboardSummary,
} = require('../controllers/taskController');

router.use(protect); // every task route requires a logged-in user

/**
 * @openapi
 * /tasks/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get task counts for the current user (total / pending / completed)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Summary counts }
 */
router.get('/dashboard/summary', getDashboardSummary);

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List the current user's tasks (search, filter, paginate)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Case-insensitive match against the task title
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [todo, in-progress, completed] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high] }
 *       - in: query
 *         name: project
 *         schema: { type: string }
 *         description: Project id to filter by
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated list of tasks }
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, project]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               priority: { type: string, enum: [low, medium, high] }
 *               status: { type: string, enum: [todo, in-progress, completed] }
 *               dueDate: { type: string, format: date }
 *               project: { type: string }
 *     responses:
 *       201: { description: Task created }
 *       404: { description: Project not found }
 */
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required')
      .isLength({ max: 120 }).withMessage('Title cannot exceed 120 characters'),
    body('description').optional({ nullable: true }).isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('project').notEmpty().withMessage('Project is required')
      .isMongoId().withMessage('Project must be a valid id'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isMongoId().withMessage('Each tag must be a valid id'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('status').optional().isIn(['todo', 'in-progress', 'completed']).withMessage('Invalid status'),
    body('dueDate').optional({ nullable: true }).isISO8601().withMessage('Invalid due date'),
  ],
  validate,
  createTask
);
router.get(
  '/',
  [
    query('status').optional().isIn(['todo', 'in-progress', 'completed']).withMessage('Invalid status filter'),
    query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority filter'),
    query('project').optional().isMongoId().withMessage('Project must be a valid id'),
    query('tag').optional().isMongoId().withMessage('Tag must be a valid id'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],
  validate,
  getTasks
);

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a single task
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Task found }
 *       404: { description: Task not found }
 *   put:
 *     tags: [Tasks]
 *     summary: Update a task
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Task updated }
 *       404: { description: Task not found }
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Task deleted }
 *       404: { description: Task not found }
 */
router.get('/:id', getTaskById);
router.put(
  '/:id',
  [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty')
      .isLength({ max: 120 }).withMessage('Title cannot exceed 120 characters'),
    body('description').optional({ nullable: true }).isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('project').optional().isMongoId().withMessage('Project must be a valid id'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isMongoId().withMessage('Each tag must be a valid id'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('status').optional().isIn(['todo', 'in-progress', 'completed']).withMessage('Invalid status'),
    body('dueDate').optional({ nullable: true }).isISO8601().withMessage('Invalid due date'),
  ],
  validate,
  updateTask
);
router.delete('/:id', deleteTask);

module.exports = router;
