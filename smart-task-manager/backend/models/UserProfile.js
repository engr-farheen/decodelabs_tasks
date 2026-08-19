const mongoose = require('mongoose');

// One-to-One (1:1): exactly one profile per user. The unique index on
// "user" is what enforces the strict 1:1 exclusivity — Mongo will reject
// a second profile document for the same user.
const userProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [300, 'Bio cannot exceed 300 characters'],
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone cannot exceed 30 characters'],
      default: '',
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Avatar URL cannot exceed 500 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserProfile', userProfileSchema);
