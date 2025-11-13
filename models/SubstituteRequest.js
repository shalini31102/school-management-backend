// models/SubstituteRequest.js
const mongoose = require('mongoose');

const substituteRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  periods: [{
    periodNumber: {
      type: Number,
      required: true,
      min: 1
    },
    startTime: String,
    endTime: String
  }],
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
  subject: {
    type: String,
    required: true,
    trim: true
  },
  substituteTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  reason: {
    type: String,
    required: [true, 'Reason for absence is required'],
    trim: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }]
}, {
  timestamps: true
});

// Indexes
substituteRequestSchema.index({ requestedBy: 1, date: -1 });
substituteRequestSchema.index({ status: 1, date: -1 });
substituteRequestSchema.index({ substituteTeacher: 1, date: -1 });
substituteRequestSchema.index({ class: 1, section: 1, date: -1 });

// Pre-save validation to ensure date is not in the past
substituteRequestSchema.pre('save', function(next) {
  if (this.isNew) {
    const requestDate = new Date(this.date);
    requestDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestDate < today) {
      return next(new Error('Cannot request substitute for past dates'));
    }
  }
  next();
});

// Method to approve request
substituteRequestSchema.methods.approve = async function(approvedBy, substituteTeacherId, notes) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  this.substituteTeacher = substituteTeacherId;
  if (notes) this.notes = notes;
  
  return await this.save();
};

// Method to reject request
substituteRequestSchema.methods.reject = async function(rejectedBy, reason) {
  this.status = 'rejected';
  this.approvedBy = rejectedBy;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  
  return await this.save();
};

// Static method to get pending requests
substituteRequestSchema.statics.getPendingRequests = async function() {
  return await this.find({
    status: 'pending',
    date: { $gte: new Date() }
  })
    .populate('requestedBy', 'name employeeId')
    .sort({ isEmergency: -1, requestedAt: 1 });
};

// Static method to get teacher's requests
substituteRequestSchema.statics.getTeacherRequests = async function(teacherId, status) {
  const query = {
    requestedBy: teacherId
  };
  
  if (status) {
    query.status = status;
  }
  
  return await this.find(query)
    .populate('substituteTeacher', 'name')
    .populate('approvedBy', 'name')
    .sort({ date: -1 });
};

// Static method to check if substitute teacher is available
substituteRequestSchema.statics.isTeacherAvailable = async function(teacherId, date, periods) {
  const Timetable = mongoose.model('Timetable');
  
  // Check if teacher has any approved substitute assignments for the same date and periods
  const existingAssignments = await this.find({
    substituteTeacher: teacherId,
    date: date,
    status: 'approved',
    'periods.periodNumber': { $in: periods.map(p => p.periodNumber) }
  });
  
  if (existingAssignments.length > 0) {
    return false;
  }
  
  // Check teacher's regular timetable
  const teacher = await mongoose.model('Teacher').findById(teacherId);
  if (teacher.isClassTeacher) {
    const timetable = await Timetable.findOne({
      class: teacher.assignedClass,
      section: teacher.assignedSection,
      isActive: true
    });
    
    if (timetable) {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(date).getDay()];
      const daySchedule = timetable.schedule.find(s => s.day === dayName);
      
      if (daySchedule) {
        const conflictingPeriods = daySchedule.periods.filter(p => 
          periods.some(period => period.periodNumber === p.periodNumber) && !p.isFree
        );
        
        if (conflictingPeriods.length > 0) {
          return false;
        }
      }
    }
  }
  
  return true;
};

// Static method to get substitute assignments for a teacher
substituteRequestSchema.statics.getSubstituteAssignments = async function(teacherId, startDate, endDate) {
  return await this.find({
    substituteTeacher: teacherId,
    status: 'approved',
    date: { $gte: startDate, $lte: endDate }
  })
    .populate('requestedBy', 'name')
    .sort({ date: 1 });
};

const SubstituteRequest = mongoose.model('SubstituteRequest', substituteRequestSchema);

module.exports = SubstituteRequest;