const Tag = require('../models/Tag');
const Task = require('../models/Task');

/**
 * POST /api/tags
 */
exports.createTag = async (req, res, next) => {
  try {
    const { name } = req.body;
    const tag = await Tag.create({ name, user: req.user._id });
    res.status(201).json(tag);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You already have a tag with that name' });
    }
    next(error);
  }
};

/**
 * GET /api/tags
 */
exports.getTags = async (req, res, next) => {
  try {
    const tags = await Tag.find({ user: req.user._id }).sort({ name: 1 }).lean();
    res.json(tags);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tags/:id
 * Also pulls the tag out of every task that references it, so no task
 * is left pointing at a deleted tag.
 */
exports.deleteTag = async (req, res, next) => {
  try {
    const tag = await Tag.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!tag) return res.status(404).json({ message: 'Tag not found' });

    await Task.updateMany(
      { user: req.user._id, tags: tag._id },
      { $pull: { tags: tag._id } }
    );

    res.json({ message: 'Tag deleted' });
  } catch (error) {
    next(error);
  }
};
