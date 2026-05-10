// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['task_assigned', 'task_graded', 'free_period', 'deadline_warning', 'daily_plan_ready', 'goal_achieved', 'test_reminder'],
    required: true,
  },
  isRead: { type: Boolean, default: false },
  data:   { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
