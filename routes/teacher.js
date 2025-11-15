// routes/teacher.js
const express = require('express');
const router = express.Router();
const {
  scanQRAttendance,
  getAttendanceHistory,
  getClassStudents,
  markMultipleAttendance,
  assignTask,
  getMyTasks,
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher', 'admin'));

// Attendance routes
router.post('/attendance/scan-qr', scanQRAttendance);
router.post('/attendance/mark-multiple', markMultipleAttendance);
router.get('/attendance/history/:class/:section', getAttendanceHistory);

// Student routes
router.get('/students/:class/:section', getClassStudents);

// Task routes
router.post('/tasks/assign', assignTask);
router.get('/tasks/my-tasks', getMyTasks);

module.exports = router;