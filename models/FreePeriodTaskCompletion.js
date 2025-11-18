// models/FreePeriodTaskCompletion.js
const mongoose = require('mongoose');

const freePeriodTaskCompletionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  taskTitle: {
    type: String,
    required: true,
    trim: true
  },
  taskCategory: {
    type: String,
    enum: ['interest', 'career', 'improvement'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  subject: {
    type: String,
    trim: true
  },
  estimatedTime: {
    type: Number, // in minutes
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: {
    type: String,
    trim: true
  },
  wasHelpful: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
freePeriodTaskCompletionSchema.index({ studentId: 1, completedAt: -1 });
freePeriodTaskCompletionSchema.index({ taskCategory: 1 });

// Static method to get student statistics
freePeriodTaskCompletionSchema.statics.getStudentStats = async function(studentId) {
  const completions = await this.find({ studentId });
  
  const totalCompleted = completions.length;
  const byCategory = {
    interest: completions.filter(c => c.taskCategory === 'interest').length,
    career: completions.filter(c => c.taskCategory === 'career').length,
    improvement: completions.filter(c => c.taskCategory === 'improvement').length,
  };
  
  const totalMinutes = completions.reduce((sum, c) => sum + c.estimatedTime, 0);
  const averageRating = completions
    .filter(c => c.rating)
    .reduce((sum, c, _, arr) => sum + c.rating / arr.length, 0);
  
  return {
    totalCompleted,
    byCategory,
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(1),
    averageRating: averageRating.toFixed(1),
  };
};

const FreePeriodTaskCompletion = mongoose.model('FreePeriodTaskCompletion', freePeriodTaskCompletionSchema);

module.exports = FreePeriodTaskCompletion;