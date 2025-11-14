// routes/teacher.js
const express = require('express');
const router = express.Router();
const {
  scanQRAttendance,
  getAttendanceHistory,
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher', 'admin'));

// Attendance routes
router.post('/attendance/scan-qr', scanQRAttendance);
router.get('/attendance/history/:class/:section', getAttendanceHistory);

module.exports = router;