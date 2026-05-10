// routes/teacher.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  scanQRAttendance,
  getAttendanceHistory,
  getClassStudents,
  markMultipleAttendance,
  assignTask,
  getMyTasks,
  getTodayAttendanceCount,
  getCurrentFreePeriods,
  updateStudentAcademicProfile,
  getStudentProfile,
  startFreePeriodSession,
  endFreePeriodSession,
  getActiveFreePeriodSession,
  getSessionHistory,
} = require('../controllers/teacherController');
const {
  createCustomTask,
  getMyCustomTasks,
  deleteCustomTask,
} = require('../controllers/customTaskController');
const {
  getTaskSubmissions,
  gradeSubmission,
  bulkGradeSubmissions,
} = require('../controllers/gradingController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes require authentication and teacher role
router.use(protect);
router.use(authorize('teacher', 'admin'));

// ── Attendance routes ────────────────────────────────────────────────────────
router.post(
  '/attendance/scan-qr',
  [
    body('qrCode').notEmpty().withMessage('QR code is required').trim(),
    body('teacherId').notEmpty().withMessage('Teacher ID is required').isMongoId().withMessage('Invalid teacher ID'),
  ],
  validate,
  scanQRAttendance
);

router.post(
  '/attendance/mark-multiple',
  [
    body('teacherId').notEmpty().withMessage('Teacher ID is required').isMongoId().withMessage('Invalid teacher ID'),
    body('attendance').isArray({ min: 1 }).withMessage('Attendance must be a non-empty array'),
    body('attendance.*.studentId').isMongoId().withMessage('Each student ID must be a valid ID'),
    body('attendance.*.status')
      .isIn(['present', 'absent', 'late', 'excused'])
      .withMessage('Status must be present, absent, late, or excused'),
  ],
  validate,
  markMultipleAttendance
);

router.get('/attendance/history/:class/:section', getAttendanceHistory);
router.get('/attendance/today/:class/:section', getTodayAttendanceCount);

// ── Free period routes ───────────────────────────────────────────────────────
router.get('/free-periods/current', getCurrentFreePeriods);

router.post(
  '/free-period/start',
  [
    body('class').notEmpty().withMessage('Class is required').trim(),
    body('section').notEmpty().withMessage('Section is required').trim(),
    body('duration').isInt({ min: 5, max: 120 }).withMessage('Duration must be 5–120 minutes'),
    body('missedSubject').optional().trim(),
    body('note').optional().trim(),
  ],
  validate,
  startFreePeriodSession
);
router.post('/free-period/end', endFreePeriodSession);
router.get('/free-period/active', getActiveFreePeriodSession);
router.get('/free-period/history', getSessionHistory);

// ── Student routes ───────────────────────────────────────────────────────────
router.get('/students/:class/:section', getClassStudents);

router.get('/students/:id/profile', getStudentProfile);

router.patch(
  '/students/:id/academic',
  [
    body('performanceLevel').optional().isIn(['weak', 'medium', 'strong']).withMessage('Invalid performance level'),
    body('learningPace').optional().isIn(['slow', 'medium', 'fast']).withMessage('Invalid learning pace'),
    body('interests').optional().isArray().withMessage('Interests must be an array'),
    body('careerGoals').optional().isArray().withMessage('Career goals must be an array'),
  ],
  validate,
  updateStudentAcademicProfile
);

// ── Task routes ──────────────────────────────────────────────────────────────
router.post(
  '/tasks/assign',
  [
    body('title').notEmpty().withMessage('Task title is required').trim(),
    body('description').notEmpty().withMessage('Task description is required').trim(),
    body('subject').notEmpty().withMessage('Subject is required').trim(),
    body('dueDate').notEmpty().withMessage('Due date is required').isISO8601().withMessage('Invalid date format'),
    body('teacherId').notEmpty().withMessage('Teacher ID is required').isMongoId().withMessage('Invalid teacher ID'),
    body('targetClass').notEmpty().withMessage('Target class is required').trim(),
    body('targetSection').notEmpty().withMessage('Target section is required').trim(),
    body('totalMarks').optional().isInt({ min: 1, max: 1000 }).withMessage('Total marks must be between 1 and 1000'),
  ],
  validate,
  assignTask
);

router.get('/tasks/my-tasks', getMyTasks);

// ── Custom free period tasks ─────────────────────────────────────────────────
router.post('/custom-tasks/create', createCustomTask);
router.get('/custom-tasks', getMyCustomTasks);
router.delete('/custom-tasks/:id', deleteCustomTask);

// ── Grading routes ───────────────────────────────────────────────────────────
router.get(
  '/grading/task/:taskId',
  [param('taskId').isMongoId().withMessage('Invalid task ID')],
  validate,
  getTaskSubmissions
);

router.post(
  '/grading/grade/:submissionId',
  [
    param('submissionId').isMongoId().withMessage('Invalid submission ID'),
    body('score').notEmpty().withMessage('Score is required').isNumeric().withMessage('Score must be a number'),
    body('feedback').optional().trim(),
  ],
  validate,
  gradeSubmission
);

router.post(
  '/grading/bulk-grade',
  [
    body('grades').isArray({ min: 1 }).withMessage('Grades must be a non-empty array'),
    body('grades.*.submissionId').isMongoId().withMessage('Each submission ID must be valid'),
    body('grades.*.score').isNumeric().withMessage('Each score must be a number'),
  ],
  validate,
  bulkGradeSubmissions
);

module.exports = router;
