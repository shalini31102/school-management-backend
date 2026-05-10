// routes/admin.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  addStudent,
  getAllStudents,
  createTimetable,
  getTimetable,
  updateTimetable,
  getAllTimetables,
  getAnalytics,
  getAllTeachers,
  addTeacher,
  updateTeacher,
  updateStudent,
  getStudentById,
  createAdmin,
  getAllClasses,
  getFullAttendanceHistory,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// Protect all routes
router.use(protect);

// ── Student management ───────────────────────────────────────────────────────
router.post(
  '/students/add',
  authorize('admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Student name is required').trim(),
    body('rollNumber').notEmpty().withMessage('Roll number is required').trim(),
    body('class').notEmpty().withMessage('Class is required').trim(),
    body('section').notEmpty().withMessage('Section is required').trim(),
  ],
  validate,
  addStudent
);

router.get('/students', authorize('admin'), getAllStudents);

router.get('/students/:id', authorize('admin'), getStudentById);

router.patch(
  '/students/:id',
  authorize('admin'),
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
    body('class').optional().notEmpty().withMessage('Class cannot be empty').trim(),
    body('section').optional().notEmpty().withMessage('Section cannot be empty').trim(),
    body('rollNumber').optional().notEmpty().withMessage('Roll number cannot be empty').trim(),
    body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  ],
  validate,
  updateStudent
);

// ── Teacher management ────────────────────────────────────────────────────────
router.get('/teachers', authorize('admin'), getAllTeachers);

router.patch(
  '/teachers/:id',
  authorize('admin'),
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
    body('contactNumber').optional().matches(/^[0-9]{10}$/).withMessage('Contact number must be 10 digits'),
    body('subjects').optional().isArray().withMessage('Subjects must be an array'),
    body('experience').optional().isNumeric({ min: 0 }).withMessage('Experience must be a non-negative number'),
    body('isClassTeacher').optional().isBoolean(),
    body('assignedClass').optional().trim(),
    body('assignedSection').optional().trim(),
    body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  ],
  validate,
  updateTeacher
);

router.post(
  '/teachers/add',
  authorize('admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().withMessage('Teacher name is required').trim(),
    body('employeeId').notEmpty().withMessage('Employee ID is required').trim(),
    body('contactNumber')
      .matches(/^[0-9]{10}$/)
      .withMessage('Contact number must be a valid 10-digit number'),
    body('subjects').optional().isArray().withMessage('Subjects must be an array'),
    body('experience').optional().isNumeric({ min: 0 }).withMessage('Experience must be a non-negative number'),
    body('isClassTeacher').optional().isBoolean(),
    body('assignedClass').optional().trim(),
    body('assignedSection').optional().trim(),
  ],
  validate,
  addTeacher
);

// ── Timetable management ─────────────────────────────────────────────────────
router.post(
  '/timetable/create',
  authorize('admin'),
  [
    body('class').notEmpty().withMessage('Class is required').trim(),
    body('section').notEmpty().withMessage('Section is required').trim(),
    body('schedule').isArray({ min: 1 }).withMessage('Schedule must be a non-empty array'),
    body('schedule.*.day')
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
      .withMessage('Invalid day name'),
    body('schedule.*.periods').isArray({ min: 1 }).withMessage('Periods must be a non-empty array'),
    body('schedule.*.periods.*.periodNumber').isInt({ min: 0 }).withMessage('Period number must be a non-negative integer'),
    body('schedule.*.periods.*.startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Start time must be in HH:MM format'),
    body('schedule.*.periods.*.endTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('End time must be in HH:MM format'),
  ],
  validate,
  createTimetable
);

// Timetable GET — accessible by admin, teacher, and student
router.get(
  '/timetable/:class/:section',
  authorize('admin', 'teacher', 'student'),
  getTimetable
);

// Timetable PUT — upsert (update if exists, create if not)
router.put('/timetable/update', authorize('admin'), updateTimetable);

// Timetable GET all — list all active timetables
router.get('/timetable/all', authorize('admin'), getAllTimetables);

// ── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics', authorize('admin'), getAnalytics);

// ── Classes ──────────────────────────────────────────────────────────────────
router.get('/classes', authorize('admin'), getAllClasses);

// ── Admin management ─────────────────────────────────────────────────────────
router.post(
  '/create-admin',
  authorize('admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('employeeId').notEmpty().trim().withMessage('Employee ID is required'),
  ],
  validate,
  createAdmin
);

// ── Attendance history ────────────────────────────────────────────────────────
router.get('/attendance/history', authorize('admin'), getFullAttendanceHistory);

module.exports = router;
