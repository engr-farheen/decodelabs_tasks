const UserProfile = require('../models/UserProfile');

/**
 * GET /api/profile
 * Returns the current user's profile, creating an empty one if it
 * somehow doesn't exist yet (defensive — registration always creates one).
 */
exports.getMyProfile = async (req, res, next) => {
  try {
    let profile = await UserProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await UserProfile.create({ user: req.user._id });
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/profile
 */
exports.updateMyProfile = async (req, res, next) => {
  try {
    const { bio, phone, avatarUrl } = req.body;
    const update = {};
    if (bio !== undefined) update.bio = bio;
    if (phone !== undefined) update.phone = phone;
    if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;

    // Nothing to change — just return the current (or newly-created)
    // profile instead of sending MongoDB an empty update document.
    if (Object.keys(update).length === 0) {
      let existing = await UserProfile.findOne({ user: req.user._id });
      if (!existing) existing = await UserProfile.create({ user: req.user._id });
      return res.json(existing);
    }

    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user._id },
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (error) {
    next(error);
  }
};
