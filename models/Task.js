// models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['quiz', 'assignment', 'practice', 'interest-based', 'career-oriented', 'revision'],
    required: true,
    default: 'assignment'
  },
  subject: {
    type: String,
    trim: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  targetClass: {
    type: String,
    trim: true
  },
  targetSection: {
    type: String,
    uppercase: true,
    trim: true
  },
  isPersonalized: {
    type: Boolean,
    default: false
  },
  isForFreePeriod: {
    type: Boolean,
    default: false
  },
  interestCategory: {
    type: String,
    trim: true
  },
  careerCategory: {
    type: String,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  totalMarks: {
    type: Number,
    min: 0,
    default: 10
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  instructions: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
taskSchema.index({ assignedTo: 1, dueDate: 1 });
taskSchema.index({ targetClass: 1, targetSection: 1, dueDate: 1 });
taskSchema.index({ assignedBy: 1, createdAt: -1 });
taskSchema.index({ type: 1, isActive: 1 });
// Composite indexes for common teacher/student dashboard queries
taskSchema.index({ assignedBy: 1, isActive: 1 });
taskSchema.index({ assignedTo: 1, isActive: 1 });

// Virtual to check if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate < new Date() && this.status === 'active';
});

// Method to assign task to all students in a class
taskSchema.statics.assignToClass = async function(taskData) {
  const { targetClass, targetSection, ...restData } = taskData;
  
  // Get all students from the class
  const Student = mongoose.model('Student');
  const students = await Student.find({
    class: targetClass,
    section: targetSection,
    isActive: true
  }).select('_id');
  
  const studentIds = students.map(s => s._id);
  
  return await this.create({
    ...restData,
    targetClass,
    targetSection,
    assignedTo: studentIds
  });
};

// Method to get personalized tasks for a student
taskSchema.statics.getPersonalizedTasks = async function(studentId) {
  const Student = mongoose.model('Student');
  const student = await Student.findById(studentId);
  
  if (!student) {
    throw new Error('Student not found');
  }
  
  return await this.find({
    $or: [
      { assignedTo: studentId },
      {
        targetClass: student.class,
        targetSection: student.section,
        isPersonalized: false
      },
      {
        isPersonalized: true,
        interestCategory: { $in: student.interests }
      },
      {
        isPersonalized: true,
        careerCategory: { $in: student.careerGoals }
      }
    ],
    isActive: true,
    dueDate: { $gte: new Date() }
  }).populate('assignedBy', 'name')
    .sort({ dueDate: 1 });
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;