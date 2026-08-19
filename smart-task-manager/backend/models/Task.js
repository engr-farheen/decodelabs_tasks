const mongoose = require('mongoose');

// One-to-Many: one Project has many Tasks; one User owns many Tasks
// Many-to-Many: Task <-> Tag (see tags field below)
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'completed'],
      default: 'todo',
    },
    dueDate: {
      type: Date,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    // Many-to-Many: a task can carry many tags, a tag can apply to many tasks
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Speeds up the common "my tasks, filtered by status/priority, sorted by
// due date" query. (No text index here — search uses an escaped $regex
// against title, not MongoDB's $text operator, so a text index would just
// add write overhead without ever being used.)
taskSchema.index({ user: 1, status: 1, priority: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
