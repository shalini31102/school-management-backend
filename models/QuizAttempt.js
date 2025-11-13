// models/QuizAttempt.js
const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  answers: [{
    questionIndex: {
      type: Number,
      required: true
    },
    selectedOption: {
      type: Number,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    marksAwarded: {
      type: Number,
      default: 0
    }
  }],
  score: {
    type: Number,
    required: true,
    min: 0
  },
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  isPassed: {
    type: Boolean,
    default: false
  },
  attemptNumber: {
    type: Number,
    default: 1,
    min: 1
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  attemptedAt: {
    type: Date,
    default: Date.now
  },
  timeTaken: {
    type: Number, // in minutes
    required: true
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'abandoned'],
    default: 'completed'
  }
}, {
  timestamps: true
});

// Compound index
quizAttemptSchema.index({ quizId: 1, studentId: 1 });
quizAttemptSchema.index({ studentId: 1, attemptedAt: -1 });

// Pre-save middleware to calculate score and percentage
quizAttemptSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('answers')) {
    const Quiz = mongoose.model('Quiz');
    const quiz = await Quiz.findById(this.quizId);
    
    if (!quiz) {
      return next(new Error('Quiz not found'));
    }
    
    // Calculate score
    let totalScore = 0;
    this.answers.forEach(answer => {
      const question = quiz.questions[answer.questionIndex];
      if (answer.selectedOption === question.correctAnswer) {
        answer.isCorrect = true;
        answer.marksAwarded = question.marks;
        totalScore += question.marks;
      } else {
        answer.isCorrect = false;
        answer.marksAwarded = 0;
      }
    });
    
    this.score = totalScore;
    this.totalMarks = quiz.totalMarks;
    this.percentage = (totalScore / quiz.totalMarks) * 100;
    this.isPassed = totalScore >= quiz.passingMarks;
  }
  next();
});

// Static method to submit quiz attempt
quizAttemptSchema.statics.submitAttempt = async function(attemptData) {
  const { quizId, studentId, answers, timeTaken } = attemptData;
  
  const Quiz = mongoose.model('Quiz');
  const quiz = await Quiz.findById(quizId);
  
  if (!quiz) {
    throw new Error('Quiz not found');
  }
  
  // Check if quiz is still active
  const now = new Date();
  if (now > quiz.endTime) {
    throw new Error('Quiz has ended');
  }
  
  // Check previous attempts
  const previousAttempts = await this.countDocuments({ quizId, studentId });
  
  if (!quiz.allowMultipleAttempts && previousAttempts > 0) {
    throw new Error('Multiple attempts not allowed');
  }
  
  if (previousAttempts >= quiz.maxAttempts) {
    throw new Error('Maximum attempts reached');
  }
  
  // Create attempt
  return await this.create({
    quizId,
    studentId,
    answers,
    timeTaken,
    attemptNumber: previousAttempts + 1
  });
};

// Static method to get student's quiz statistics
quizAttemptSchema.statics.getStudentQuizStats = async function(studentId, startDate, endDate) {
  const attempts = await this.find({
    studentId,
    attemptedAt: { $gte: startDate, $lte: endDate },
    status: 'completed'
  });
  
  const totalAttempts = attempts.length;
  const passed = attempts.filter(a => a.isPassed).length;
  const averageScore = attempts.reduce((sum, a) => sum + a.percentage, 0) / (totalAttempts || 1);
  
  return {
    totalAttempts,
    passed,
    failed: totalAttempts - passed,
    averageScore: averageScore.toFixed(2),
    passRate: totalAttempts > 0 ? ((passed / totalAttempts) * 100).toFixed(2) : 0
  };
};

// Static method to get quiz analytics for teacher
quizAttemptSchema.statics.getQuizAnalytics = async function(quizId) {
  const attempts = await this.find({ quizId, status: 'completed' });
  
  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0
    };
  }
  
  const scores = attempts.map(a => a.percentage);
  const passed = attempts.filter(a => a.isPassed).length;
  
  return {
    totalAttempts: attempts.length,
    averageScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
    highestScore: Math.max(...scores).toFixed(2),
    lowestScore: Math.min(...scores).toFixed(2),
    passRate: ((passed / attempts.length) * 100).toFixed(2)
  };
};

const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

module.exports = QuizAttempt;