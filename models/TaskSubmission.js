// models/TaskSubmission.js
const mongoose = require('mongoose');

const taskSubmissionSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  submissionText: {
    type: String,
    trim: true
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    min: 0
  },
  feedback: {
    type: String,
    trim: true
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  gradedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'late', 'resubmit'],
    default: 'submitted'
  },
  isLate: {
    type: Boolean,
    default: false
  },
  attemptNumber: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true
});

// Compound index to track submissions
taskSubmissionSchema.index({ taskId: 1, studentId: 1 });
taskSubmissionSchema.index({ studentId: 1, submittedAt: -1 });
taskSubmissionSchema.index({ status: 1 });
// Composite index for grade-screen queries (student + graded status)
taskSubmissionSchema.index({ studentId: 1, status: 1 });

// Pre-save middleware to check if submission is late
taskSubmissionSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Task = mongoose.model('Task');
    const task = await Task.findById(this.taskId);
    
    if (task && this.submittedAt > task.dueDate) {
      this.isLate = true;
      this.status = 'late';
    }
  }
  next();
});

// Static method to submit task
taskSubmissionSchema.statics.submitTask = async function(submissionData) {
  const { taskId, studentId, submissionText, attachments } = submissionData;
  
  // Check if task exists
  const Task = mongoose.model('Task');
  const task = await Task.findById(taskId);
  
  if (!task) {
    throw new Error('Task not found');
  }
  
  // Check for previous submissions
  const previousSubmissions = await this.find({ taskId, studentId });
  const attemptNumber = previousSubmissions.length + 1;
  
  // Create submission
  return await this.create({
    taskId,
    studentId,
    submissionText,
    attachments: attachments || [],
    attemptNumber,
    isLate: new Date() > task.dueDate
  });
};

// Method to grade submission
taskSubmissionSchema.methods.gradeSubmission = async function(score, feedback, gradedBy) {
  this.score = score;
  this.feedback = feedback;
  this.gradedBy = gradedBy;
  this.gradedAt = new Date();
  this.status = 'graded';
  
  return await this.save();
};

// Static method to get student's submission statistics
taskSubmissionSchema.statics.getSubmissionStats = async function(studentId, startDate, endDate) {
  const submissions = await this.find({
    studentId,
    submittedAt: { $gte: startDate, $lte: endDate }
  });
  
  const total = submissions.length;
  const graded = submissions.filter(s => s.status === 'graded').length;
  const late = submissions.filter(s => s.isLate).length;
  const averageScore = submissions
    .filter(s => s.score !== undefined)
    .reduce((sum, s) => sum + s.score, 0) / (graded || 1);
  
  return {
    total,
    graded,
    late,
    onTime: total - late,
    averageScore: averageScore.toFixed(2),
    completionRate: total > 0 ? ((total / total) * 100).toFixed(2) : 0
  };
};

const TaskSubmission = mongoose.model('TaskSubmission', taskSubmissionSchema);

module.exports = TaskSubmission;