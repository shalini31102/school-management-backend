// models/index.js
// Central export file for all models

const User = require('./User');
const Student = require('./Student');
const Teacher = require('./Teacher');
const Admin = require('./Admin');
const Timetable = require('./Timetable');
const Attendance = require('./Attendance');
const Task = require('./Task');
const TaskSubmission = require('./TaskSubmission');
const Quiz = require('./Quiz');
const QuizAttempt = require('./QuizAttempt');
const SubstituteRequest = require('./SubstituteRequest');
const StudentPerformance = require('./StudentPerformance');

module.exports = {
  User,
  Student,
  Teacher,
  Admin,
  Timetable,
  Attendance,
  Task,
  TaskSubmission,
  Quiz,
  QuizAttempt,
  SubstituteRequest,
  StudentPerformance
};