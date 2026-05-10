// models/DailyStudyPlan.js
const mongoose = require('mongoose');

const studyTaskSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  description:   { type: String },
  subject:       { type: String },
  estimatedTime: { type: Number },
  difficulty:    { type: String, enum: ['easy', 'medium', 'hard'] },
  priority:      { type: Number, default: 1 },
  isCompleted:   { type: Boolean, default: false },
}, { _id: false });

const dailyStudyPlanSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  date:        { type: Date, required: true },
  tasks:       [studyTaskSchema],
  aiContext:   { type: String },
  generatedAt: { type: Date, default: Date.now },
  isViewed:    { type: Boolean, default: false },
}, { timestamps: true });

dailyStudyPlanSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyStudyPlan', dailyStudyPlanSchema);
