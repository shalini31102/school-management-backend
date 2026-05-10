// models/ClassFreePeriodSession.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  description:   { type: String },
  subject:       { type: String },
  difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  estimatedTime: { type: Number }, // minutes
  category:      { type: String },
  matchReason:   { type: String },
}, { _id: false });

const classFreePeriodSessionSchema = new mongoose.Schema({
  teacherId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  class:        { type: String, required: true },
  section:      { type: String, required: true },
  missedSubject:{ type: String },
  duration:     { type: Number }, // minutes
  note:         { type: String }, // optional message to students
  tasks:        { type: [taskSchema], default: [] },
  isActive:     { type: Boolean, default: true },
  startedAt:    { type: Date, default: Date.now },
  endsAt:       { type: Date }, // startedAt + duration
  endedAt:      { type: Date }, // when teacher manually ends
}, { timestamps: true });

classFreePeriodSessionSchema.index({ class: 1, section: 1, isActive: 1 });
classFreePeriodSessionSchema.index({ teacherId: 1, startedAt: -1 });

module.exports = mongoose.model('ClassFreePeriodSession', classFreePeriodSessionSchema);
