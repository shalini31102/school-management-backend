// models/StudentPerformance.js
const mongoose = require('mongoose');

const subjectPerformanceSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true
  },
  averageScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalAssignments: {
    type: Number,
    default: 0
  },
  completedAssignments: {
    type: Number,
    default: 0
  },
  totalQuizzes: {
    type: Number,
    default: 0
  },
  averageQuizScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  trend: {
    type: String,
    enum: ['improving', 'declining', 'stable'],
    default: 'stable'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const studentPerformanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    unique: true
  },
  month: {
    type: String,
    required: true // Format: "YYYY-MM"
  },
  academicYear: {
    type: String,
    required: true
  },
  attendancePercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalDays: {
    type: Number,
    default: 0
  },
  presentDays: {
    type: Number,
    default: 0
  },
  tasksCompleted: {
    type: Number,
    default: 0
  },
  tasksAssigned: {
    type: Number,
    default: 0
  },
  taskCompletionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  averageQuizScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  totalQuizzesTaken: {
    type: Number,
    default: 0
  },
  quizzesPassed: {
    type: Number,
    default: 0
  },
  subjectWisePerformance: [subjectPerformanceSchema],
  strengthAreas: [{
    type: String,
    trim: true
  }],
  weaknessAreas: [{
    type: String,
    trim: true
  }],
  recommendations: [{
    type: String,
    trim: true
  }],
  overallGrade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
    default: 'C'
  },
  behaviorRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  participationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  lastCalculated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
studentPerformanceSchema.index({ studentId: 1, month: 1 });
studentPerformanceSchema.index({ academicYear: 1 });

// Static method to calculate and update performance
studentPerformanceSchema.statics.calculatePerformance = async function(studentId, month) {
  const Student = mongoose.model('Student');
  const Attendance = mongoose.model('Attendance');
  const TaskSubmission = mongoose.model('TaskSubmission');
  const QuizAttempt = mongoose.model('QuizAttempt');
  const Task = mongoose.model('Task');
  
  const student = await Student.findById(studentId);
  if (!student) {
    throw new Error('Student not found');
  }
  
  // Parse month (format: YYYY-MM)
  const [year, monthNum] = month.split('-');
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Calculate attendance
  const attendanceRecords = await Attendance.find({
    studentId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(a => 
    a.status === 'present' || a.status === 'late'
  ).length;
  const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
  
  // Calculate task completion
  const assignedTasks = await Task.find({
    assignedTo: studentId,
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  const submissions = await TaskSubmission.find({
    studentId,
    submittedAt: { $gte: startDate, $lte: endDate }
  });
  
  const tasksAssigned = assignedTasks.length;
  const tasksCompleted = submissions.filter(s => s.status === 'graded').length;
  const taskCompletionRate = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 0;
  
  // Calculate quiz performance
  const quizAttempts = await QuizAttempt.find({
    studentId,
    attemptedAt: { $gte: startDate, $lte: endDate },
    status: 'completed'
  });
  
  const totalQuizzesTaken = quizAttempts.length;
  const quizzesPassed = quizAttempts.filter(q => q.isPassed).length;
  const averageQuizScore = totalQuizzesTaken > 0
    ? quizAttempts.reduce((sum, q) => sum + q.percentage, 0) / totalQuizzesTaken
    : 0;
  
  // Calculate subject-wise performance
  const subjects = {};
  
  submissions.forEach(sub => {
    const task = assignedTasks.find(t => t._id.equals(sub.taskId));
    if (task && task.subject) {
      if (!subjects[task.subject]) {
        subjects[task.subject] = {
          subject: task.subject,
          scores: [],
          totalAssignments: 0,
          completedAssignments: 0
        };
      }
      subjects[task.subject].totalAssignments++;
      if (sub.status === 'graded') {
        subjects[task.subject].completedAssignments++;
        subjects[task.subject].scores.push((sub.score / task.totalMarks) * 100);
      }
    }
  });
  
  const subjectWisePerformance = Object.values(subjects).map(sub => ({
    subject: sub.subject,
    averageScore: sub.scores.length > 0
      ? sub.scores.reduce((a, b) => a + b, 0) / sub.scores.length
      : 0,
    totalAssignments: sub.totalAssignments,
    completedAssignments: sub.completedAssignments,
    trend: 'stable' // This would need historical data for accurate trend
  }));
  
  // Determine strengths and weaknesses
  const strengthAreas = subjectWisePerformance
    .filter(s => s.averageScore >= 75)
    .map(s => s.subject);
  
  const weaknessAreas = subjectWisePerformance
    .filter(s => s.averageScore < 60)
    .map(s => s.subject);
  
  // Generate recommendations
  const recommendations = [];
  if (attendancePercentage < 75) {
    recommendations.push('Improve attendance to enhance learning outcomes');
  }
  if (taskCompletionRate < 70) {
    recommendations.push('Focus on completing assigned tasks on time');
  }
  if (averageQuizScore < 60) {
    recommendations.push('Spend more time on revision and practice');
  }
  weaknessAreas.forEach(subject => {
    recommendations.push(`Need improvement in ${subject}`);
  });
  
  // Calculate overall grade
  const overallScore = (attendancePercentage * 0.2) + 
                       (taskCompletionRate * 0.3) + 
                       (averageQuizScore * 0.5);
  
  let overallGrade;
  if (overallScore >= 90) overallGrade = 'A+';
  else if (overallScore >= 80) overallGrade = 'A';
  else if (overallScore >= 70) overallGrade = 'B+';
  else if (overallScore >= 60) overallGrade = 'B';
  else if (overallScore >= 50) overallGrade = 'C+';
  else if (overallScore >= 40) overallGrade = 'C';
  else if (overallScore >= 33) overallGrade = 'D';
  else overallGrade = 'F';
  
  // Update or create performance record
  const performanceData = {
    studentId,
    month,
    academicYear: `${year}-${parseInt(year) + 1}`,
    attendancePercentage,
    totalDays,
    presentDays,
    tasksCompleted,
    tasksAssigned,
    taskCompletionRate,
    averageQuizScore,
    totalQuizzesTaken,
    quizzesPassed,
    subjectWisePerformance,
    strengthAreas,
    weaknessAreas,
    recommendations,
    overallGrade,
    lastCalculated: new Date()
  };
  
  return await this.findOneAndUpdate(
    { studentId, month },
    performanceData,
    { upsert: true, new: true }
  );
};

const StudentPerformance = mongoose.model('StudentPerformance', studentPerformanceSchema);

module.exports = StudentPerformance;