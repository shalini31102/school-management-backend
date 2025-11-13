// models/Quiz.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    required: true,
    trim: true
  }],
  correctAnswer: {
    type: Number,
    required: true,
    min: 0
  },
  marks: {
    type: Number,
    required: true,
    default: 1,
    min: 0
  },
  explanation: {
    type: String,
    trim: true
  }
}, { _id: false });

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  targetClass: {
    type: String,
    required: true,
    trim: true
  },
  targetSection: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Quiz must have at least one question'
    }
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // in minutes
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  passingMarks: {
    type: Number,
    required: true,
    min: 0
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  allowMultipleAttempts: {
    type: Boolean,
    default: false
  },
  maxAttempts: {
    type: Number,
    default: 1,
    min: 1
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  showResults: {
    type: Boolean,
    default: true
  },
  instructions: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
quizSchema.index({ createdBy: 1, createdAt: -1 });
quizSchema.index({ targetClass: 1, targetSection: 1 });
quizSchema.index({ startTime: 1, endTime: 1 });

// Pre-save middleware to calculate total marks
quizSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce((sum, q) => sum + q.marks, 0);
  }
  next();
});

// Virtual to check if quiz is active
quizSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.isPublished && now >= this.startTime && now <= this.endTime;
});

// Virtual to check if quiz is upcoming
quizSchema.virtual('isUpcoming').get(function() {
  return this.isPublished && new Date() < this.startTime;
});

// Virtual to check if quiz has ended
quizSchema.virtual('hasEnded').get(function() {
  return new Date() > this.endTime;
});

// Method to get shuffled questions
quizSchema.methods.getShuffledQuestions = function() {
  if (!this.shuffleQuestions) {
    return this.questions;
  }
  
  const shuffled = [...this.questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Static method to get available quizzes for a class
quizSchema.statics.getAvailableQuizzes = async function(className, section) {
  const now = new Date();
  
  return await this.find({
    targetClass: className,
    targetSection: section,
    isPublished: true,
    startTime: { $lte: now },
    endTime: { $gte: now }
  }).populate('createdBy', 'name')
    .sort({ startTime: 1 });
};

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;