const mongoose = require('mongoose');

// Many-to-Many (Many:Many): a Task can carry many Tags, and a Tag can be
// applied to many Tasks. The link lives on Task.tags (an array of
// references) — the Mongoose equivalent of a junction table.
const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      trim: true,
      maxlength: [24, 'Tag name cannot exceed 24 characters'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Tag names only need to be unique per user, not globally
tagSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);
