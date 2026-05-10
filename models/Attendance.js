// models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    // REMOVED default function - controller handles it now
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    required: true,
    default: 'present'
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  scanMethod: {
    type: String,
    enum: ['qr', 'manual', 'biometric'],
    default: 'manual'
  },
  remarks: {
    type: String,
    trim: true
  },
  period: {
    type: Number,
    min: 1
  },
  wasEdited: {
    type: Boolean,
    default: false
  },
  modificationHistory: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    previousStatus: String,
    newStatus: String,
    reason: String
  }]
}, {
  timestamps: true
});

// Compound index to prevent duplicate attendance for same student on same day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ class: 1, section: 1, date: -1 });
attendanceSchema.index({ date: -1 });

// Static method to mark attendance
attendanceSchema.statics.markAttendance = async function(data) {
  const { studentId, status, markedBy, scanMethod, remarks } = data;
  
  const Student = mongoose.model('Student');
  const student = await Student.findById(studentId);
  
  if (!student) {
    throw new Error('Student not found');
  }
  
  // Use UTC date
  const today = new Date();
  const todayDateOnly = new Date(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0, 0, 0, 0
  ));
  
  const existingAttendance = await this.findOne({
    studentId,
    date: todayDateOnly
  });
  
  if (existingAttendance) {
    const previousStatus = existingAttendance.status;
    existingAttendance.status = status;
    existingAttendance.wasEdited = true;
    existingAttendance.modificationHistory.push({
      modifiedBy: markedBy,
      previousStatus,
      newStatus: status,
      reason: remarks || 'Status updated'
    });
    
    return await existingAttendance.save();
  }
  
  return await this.create({
    studentId,
    class: student.class,
    section: student.section,
    date: todayDateOnly,
    status,
    markedBy,
    scanMethod,
    remarks
  });
};

// Static method to get attendance statistics
attendanceSchema.statics.getAttendanceStats = async function(studentId, startDate, endDate) {
  const attendance = await this.find({
    studentId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const percentage = total > 0 ? (present / total) * 100 : 0;
  
  return {
    total,
    present,
    absent,
    percentage: percentage.toFixed(2)
  };
};

// Method to get attendance for a date range
attendanceSchema.statics.getClassAttendance = async function(className, section, date) {
  // Parse date string correctly
  const [year, month, day] = date.split('-').map(Number);
  const queryDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  
  return await this.find({
    class: className,
    section: section,
    date: queryDate
  }).populate('studentId', 'name rollNumber');
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;