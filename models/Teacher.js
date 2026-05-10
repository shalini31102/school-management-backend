// models/Teacher.js
const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Teacher name is required'],
    trim: true
  },
  subjects: [{
    type: String,
    trim: true
  }],
  isClassTeacher: {
    type: Boolean,
    default: false
  },
  assignedClass: {
    type: String,
    trim: true
  },
  assignedSection: {
    type: String,
    uppercase: true,
    trim: true
  },
  qualification: {
    type: String,
    trim: true
  },
  experience: {
    type: Number, // in years
    min: 0
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries (employeeId unique index already created by `unique: true` above)
teacherSchema.index({ subjects: 1 });
teacherSchema.index({ assignedClass: 1, assignedSection: 1 });
teacherSchema.index({ name: 'text' });

// Virtual for assigned class display
teacherSchema.virtual('assignedClassSection').get(function() {
  if (this.isClassTeacher && this.assignedClass && this.assignedSection) {
    return `${this.assignedClass}-${this.assignedSection}`;
  }
  return null;
});

// Method to check if teacher teaches a subject
teacherSchema.methods.teachesSubject = function(subject) {
  return this.subjects.includes(subject);
};

const Teacher = mongoose.model('Teacher', teacherSchema);

module.exports = Teacher;