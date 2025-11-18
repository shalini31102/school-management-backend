// models/CustomFreePeriodTask.js
const mongoose = require('mongoose');

const customFreePeriodTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  targetClass: {
    type: String,
    trim: true
  },
  targetSection: {
    type: String,
    uppercase: true,
    trim: true
  },
  targetStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  category: {
    type: String,
    enum: ['interest', 'career', 'improvement', 'general'],
    default: 'general'
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
    required: true,
    min: 5
  },
  resources: [{
    type: String,
    trim: true
  }],
  instructions: {
    type: String,
    trim: true
  },
  matchingCriteria: {
    interests: [String],
    careerGoals: [String],
    performanceLevel: {
      type: String,
      enum: ['weak', 'medium', 'strong']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
customFreePeriodTaskSchema.index({ createdBy: 1, createdAt: -1 });
customFreePeriodTaskSchema.index({ targetClass: 1, targetSection: 1 });
customFreePeriodTaskSchema.index({ isActive: 1 });

const CustomFreePeriodTask = mongoose.model('CustomFreePeriodTask', customFreePeriodTaskSchema);

module.exports = CustomFreePeriodTask;