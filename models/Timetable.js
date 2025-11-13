// models/Timetable.js
const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
  periodNumber: {
    type: Number,
    required: true,
    min: 1
  },
  subject: {
    type: String,
    trim: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  startTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  },
  endTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format']
  },
  isFree: {
    type: Boolean,
    default: false
  },
  isBreak: {
    type: Boolean,
    default: false
  },
  room: {
    type: String,
    trim: true
  }
}, { _id: false });

const dayScheduleSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  periods: [periodSchema]
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    uppercase: true,
    trim: true
  },
  academicYear: {
    type: String,
    required: true,
    default: function() {
      const year = new Date().getFullYear();
      return `${year}-${year + 1}`;
    }
  },
  schedule: [dayScheduleSchema],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for unique class-section combination
timetableSchema.index({ class: 1, section: 1, academicYear: 1, isActive: 1 });

// Method to get current day's schedule
timetableSchema.methods.getTodaySchedule = function() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  
  return this.schedule.find(s => s.day === today);
};

// Method to get free periods for a specific day
timetableSchema.methods.getFreePeriods = function(day) {
  const daySchedule = this.schedule.find(s => s.day === day);
  if (!daySchedule) return [];
  
  return daySchedule.periods.filter(p => p.isFree);
};

// Static method to get timetable by class and section
timetableSchema.statics.findByClassSection = function(className, section, academicYear) {
  return this.findOne({
    class: className,
    section: section,
    academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    isActive: true
  });
};

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;