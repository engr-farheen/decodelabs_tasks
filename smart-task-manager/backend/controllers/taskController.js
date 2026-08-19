const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Tag = require('../models/Tag');

const VALID_STATUSES = ['todo', 'in-progress', 'completed'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// Shared helper: confirms the project exists and belongs to req.user
async function assertOwnProject(projectId, userId) {
  const project = await Project.findOne({ _id: projectId, user: userId });
  return project;
}

// Shared helper: confirms every tag id in the array exists and belongs
// to req.user. Returns true only if every id checked out.
async function assertOwnTags(tagIds, userId) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return true;
  const uniqueIds = [...new Set(tagIds)];
  const count = await Tag.countDocuments({ _id: { $in: uniqueIds }, user: userId });
  return count === uniqueIds.length;
}

// Escapes regex special characters so free-text search is treated as a
// literal substring match, never as a regex pattern (prevents ReDoS and
// "invalid regex" 500s from characters like "(" or "*").
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * POST /api/tasks
 */
exports.createTask = async (req, res, next) => {
  try {
    const { title, description, priority, status, dueDate, project, tags } = req.body;

    const ownedProject = await assertOwnProject(project, req.user._id);
    if (!ownedProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const tagsOk = await assertOwnTags(tags, req.user._id);
    if (!tagsOk) {
      return res.status(404).json({ message: 'One or more tags were not found' });
    }

    const task = await Task.create({
      title,
      description,
      priority,
      status,
      dueDate: dueDate || undefined,
      project,
      tags: [...new Set(tags || [])],
      user: req.user._id,
    });

    const populated = await task.populate([
      { path: 'project', select: 'name' },
      { path: 'tags', select: 'name' },
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks
 * Query params: search, status, priority, project, page, limit
 */
exports.getTasks = async (req, res, next) => {
  try {
    const {
      search,
      status,
      priority,
      project,
      tag,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { user: req.user._id };

    // Every query param is checked for type (guards against query-string
    // tricks like ?status[$ne]=x, which would otherwise arrive as an
    // object instead of a string) and, where relevant, against a whitelist.
    if (typeof status === 'string' && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }
    if (typeof priority === 'string' && VALID_PRIORITIES.includes(priority)) {
      filter.priority = priority;
    }
    if (typeof project === 'string' && mongoose.Types.ObjectId.isValid(project)) {
      filter.project = project;
    }
    if (typeof tag === 'string' && mongoose.Types.ObjectId.isValid(tag)) {
      filter.tags = tag;
    }
    if (typeof search === 'string' && search.trim()) {
      filter.title = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const [tasks, totalCount] = await Promise.all([
      Task.find(filter)
        .populate('project', 'name')
        .populate('tags', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Task.countDocuments(filter),
    ]);

    res.json({
      tasks,
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / limitNum), 1),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks/:id
 */
exports.getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id })
      .populate('project', 'name')
      .populate('tags', 'name')
      .lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tasks/:id
 */
exports.updateTask = async (req, res, next) => {
  try {
    const { title, description, priority, status, dueDate, project, tags } = req.body;

    if (project) {
      const ownedProject = await assertOwnProject(project, req.user._id);
      if (!ownedProject) return res.status(404).json({ message: 'Project not found' });
    }

    if (tags !== undefined) {
      const tagsOk = await assertOwnTags(tags, req.user._id);
      if (!tagsOk) return res.status(404).json({ message: 'One or more tags were not found' });
    }

    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (priority !== undefined) update.priority = priority;
    if (status !== undefined) update.status = status;
    if (dueDate !== undefined) update.dueDate = dueDate;
    if (project !== undefined) update.project = project;
    if (tags !== undefined) update.tags = [...new Set(tags)];

    // Nothing to change — return the task as-is instead of sending
    // MongoDB an empty update document.
    if (Object.keys(update).length === 0) {
      const existing = await Task.findOne({ _id: req.params.id, user: req.user._id })
        .populate('project', 'name')
        .populate('tags', 'name');
      if (!existing) return res.status(404).json({ message: 'Task not found' });
      return res.json(existing);
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
      { new: true, runValidators: true }
    )
      .populate('project', 'name')
      .populate('tags', 'name');

    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tasks/:id
 */
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks/dashboard/summary
 * Simple aggregate counts for the logged-in user.
 */
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [total, todo, inProgress, completed, highPriorityOpen] = await Promise.all([
      Task.countDocuments({ user: userId }),
      Task.countDocuments({ user: userId, status: 'todo' }),
      Task.countDocuments({ user: userId, status: 'in-progress' }),
      Task.countDocuments({ user: userId, status: 'completed' }),
      Task.countDocuments({ user: userId, priority: 'high', status: { $ne: 'completed' } }),
    ]);

    res.json({
      total,
      pending: todo + inProgress,
      todo,
      inProgress,
      completed,
      highPriorityOpen,
    });
  } catch (error) {
    next(error);
  }
};
