// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  rollNumber: {
    type: String,
    required: [true, 'Roll number is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },
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
  qrCode: {
    type: String,
    unique: true,
    required: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  interests: [{
    type: String,
    trim: true
  }],
  careerGoals: [{
    type: String,
    trim: true
  }],
  learningPace: {
    type: String,
    enum: ['slow', 'medium', 'fast'],
    default: 'medium'
  },
  performanceLevel: {
    type: String,
    enum: ['weak', 'medium', 'strong'],
    default: 'medium'
  },
  parentContact: {
    name: String,
    phone: {
      type: String,
      match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
    },
    email: {
      type: String,
      lowercase: true
    }
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

// Index for faster queries (rollNumber unique index already created by `unique: true` above)
studentSchema.index({ class: 1, section: 1 });
studentSchema.index({ name: 'text' });

// Virtual for full name display
studentSchema.virtual('classSection').get(function() {
  return `${this.class}-${this.section}`;
});

// Method to generate QR data
studentSchema.methods.getQRData = function() {
  return {
    studentId: this._id.toString(),
    rollNumber: this.rollNumber,
    name: this.name,
    class: this.class,
    section: this.section
  };
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;