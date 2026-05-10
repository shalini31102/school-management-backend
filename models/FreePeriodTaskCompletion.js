// models/FreePeriodTaskCompletion.js
const mongoose = require('mongoose');

const freePeriodTaskCompletionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  taskTitle:    { type: String, required: true, trim: true },
  taskCategory: {
    type: String,
    enum: ['interest', 'career', 'improvement', 'ai', 'general', 'daily_plan', 'class_session'],
    required: true,
  },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  subject:    { type: String, trim: true },
  estimatedTime:   { type: Number, required: true },
  actualTimeSpent: { type: Number },
  completedAt: { type: Date, default: Date.now },
  selfRating:  { type: Number, min: 1, max: 5 },
  rating:      { type: Number, min: 1, max: 5 },
  notes:       { type: String, trim: true },
  wasHelpful:  { type: Boolean, default: true },
  completionSource: {
    type: String,
    enum: ['free_period', 'daily_plan', 'class_session', 'on_demand'],
    default: 'on_demand',
  },
  reviewStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs_more_work'],
    default: 'pending',
  },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  reviewedAt:      { type: Date },
  teacherFeedback: { type: String, trim: true },
}, { timestamps: true });

freePeriodTaskCompletionSchema.index({ studentId: 1, completedAt: -1 });
freePeriodTaskCompletionSchema.index({ taskCategory: 1 });
freePeriodTaskCompletionSchema.index({ studentId: 1, reviewStatus: 1 });
freePeriodTaskCompletionSchema.index({ reviewedBy: 1, reviewedAt: -1 });

freePeriodTaskCompletionSchema.statics.getStudentStats = async function(studentId) {
  const completions = await this.find({ studentId });
  const totalCompleted = completions.length;
  const byCategory = {
    interest:    completions.filter(c => c.taskCategory === 'interest').length,
    career:      completions.filter(c => c.taskCategory === 'career').length,
    improvement: completions.filter(c => c.taskCategory === 'improvement').length,
  };
  const totalMinutes = completions.reduce((sum, c) => sum + (c.actualTimeSpent || c.estimatedTime || 0), 0);
  const rated = completions.filter(c => c.selfRating || c.rating);
  const averageRating = rated.length
    ? rated.reduce((sum, c) => sum + (c.selfRating || c.rating || 0), 0) / rated.length
    : 0;
  const currentStreak = completions.length > 0 ? Math.min(completions.length, 7) : 0;
  return {
    totalCompleted,
    byCategory,
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(1),
    averageRating: averageRating.toFixed(1),
    currentStreak,
  };
};

module.exports = mongoose.model('FreePeriodTaskCompletion', freePeriodTaskCompletionSchema);
