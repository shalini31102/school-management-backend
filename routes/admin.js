// routes/admin.js
const express = require('express');
const router = express.Router();
const {
  addStudent,
  getAllStudents,
  createTimetable,
  getTimetable,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Admin-only routes
router.post('/students/add', authorize('admin'), addStudent);
router.get('/students', authorize('admin'), getAllStudents);
router.post('/timetable/create', authorize('admin'), createTimetable);

// Timetable GET - Allow admin, teacher, and student
router.get('/timetable/:class/:section', authorize('admin', 'teacher', 'student'), getTimetable);

module.exports = router;