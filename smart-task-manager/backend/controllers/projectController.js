const Project = require('../models/Project');
const Task = require('../models/Task');

/**
 * POST /api/projects
 */
exports.createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await Project.create({ name, description, user: req.user._id });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects
 */
exports.getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();

    // attach a quick task count per project (helpful for the sidebar UI)
    const withCounts = await Promise.all(
      projects.map(async (project) => {
        const taskCount = await Task.countDocuments({ project: project._id, user: req.user._id });
        return { ...project, taskCount };
      })
    );

    res.json(withCounts);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:id
 */
exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/projects/:id
 */
exports.updateProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    // Build the update object from only the fields actually sent, so a
    // partial PUT (e.g. just { name }) can never blank out the other field.
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;

    // Nothing to change — return the project as-is instead of sending
    // MongoDB an empty update document.
    if (Object.keys(update).length === 0) {
      const existing = await Project.findOne({ _id: req.params.id, user: req.user._id });
      if (!existing) return res.status(404).json({ message: 'Project not found' });
      return res.json(existing);
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/projects/:id
 * Also removes every task that belongs to this project so no orphans remain.
 */
exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    await Task.deleteMany({ project: project._id, user: req.user._id });
    res.json({ message: 'Project and its tasks were deleted' });
  } catch (error) {
    next(error);
  }
};
