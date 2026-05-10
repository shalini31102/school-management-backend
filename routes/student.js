// routes/student.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getMyTasks,
  submitTask,
  getOwnProfile,
  updateOwnProfile,
  getAttendanceStats,
  getAttendanceHistory,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} = require('../controllers/studentController');
const {
  getFreePeriodSuggestions,
  getDailyPlan,
  markTaskComplete,
  getCompletedTasks,
  getTaskStats,
} = require('../controllers/freePeriodController');
const { getMyGrades } = require('../controllers/gradingController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes require authentication and student role
router.use(protect);
router.use(authorize('student'));

// ── Profile routes ────────────────────────────────────────────────────────────
router.get('/profile', getOwnProfile);

router.patch(
  '/profile',
  [
    body('learningPace').optional().isIn(['slow', 'medium', 'fast']).withMessage('Invalid learning pace'),
    body('interests').optional().isArray().withMessage('Interests must be an array'),
    body('careerGoals').optional().isArray().withMessage('Career goals must be an array'),
  ],
  validate,
  updateOwnProfile
);

// ── Task routes ──────────────────────────────────────────────────────────────
router.get('/tasks', getMyTasks);

router.post(
  '/tasks/submit',
  [
    body('taskId').notEmpty().withMessage('Task ID is required').isMongoId().withMessage('Invalid task ID'),
    body('studentId').notEmpty().withMessage('Student ID is required').isMongoId().withMessage('Invalid student ID'),
    body('submissionText').notEmpty().withMessage('Submission text is required').trim(),
  ],
  validate,
  submitTask
);

// ── Free period suggestions ──────────────────────────────────────────────────
router.get('/free-period-suggestions', getFreePeriodSuggestions);

router.post(
  '/free-period-tasks/complete',
  [
    body('taskTitle').notEmpty().withMessage('Task title is required').trim(),
    body('taskCategory')
      .notEmpty().withMessage('Task category is required')
      .isIn(['interest', 'career', 'improvement', 'ai'])
      .withMessage('Invalid task category'),
    body('difficulty')
      .notEmpty().withMessage('Difficulty is required')
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Difficulty must be easy, medium, or hard'),
    body('estimatedTime')
      .notEmpty().withMessage('Estimated time is required')
      .isInt({ min: 1, max: 480 })
      .withMessage('Estimated time must be between 1 and 480 minutes'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('wasHelpful').optional().isBoolean(),
  ],
  validate,
  markTaskComplete
);

router.get('/free-period-tasks/completed', getCompletedTasks);
router.get('/free-period-tasks/stats', getTaskStats);

// ── Attendance ───────────────────────────────────────────────────────────────
router.get('/attendance/stats', getAttendanceStats);
router.get('/attendance/history', getAttendanceHistory);

// ── Grading ──────────────────────────────────────────────────────────────────
router.get('/grading/my-grades', getMyGrades);

// ── Daily plan ────────────────────────────────────────────────────────────────
router.get('/daily-plan', getDailyPlan);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications/unread-count', getUnreadCount);
router.get('/notifications', getNotifications);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationRead);

module.exports = router;
