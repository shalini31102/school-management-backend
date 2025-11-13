// models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
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
    required: [true, 'Admin name is required'],
    trim: true
  },
  designation: {
    type: String,
    default: 'Administrator',
    trim: true
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
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  permissions: [{
    type: String,
    enum: [
      'manage_students',
      'manage_teachers',
      'manage_timetable',
      'approve_substitutes',
      'view_analytics',
      'manage_admins'
    ]
  }],
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

// Default permissions for admin
adminSchema.pre('save', function(next) {
  if (this.isNew && this.permissions.length === 0) {
    this.permissions = [
      'manage_students',
      'manage_teachers',
      'manage_timetable',
      'approve_substitutes',
      'view_analytics'
    ];
  }
  next();
});

// Index for faster queries
adminSchema.index({ employeeId: 1 });
adminSchema.index({ name: 'text' });

// Method to check permission
adminSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;