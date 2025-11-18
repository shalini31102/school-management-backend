// routes/student.js
const express = require('express');
const router = express.Router();
const {
  getMyTasks,
  submitTask,
} = require('../controllers/studentController');
const {
  getFreePeriodSuggestions,
  markTaskComplete,
  getCompletedTasks,
  getTaskStats,
} = require('../controllers/freePeriodController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and student role
router.use(protect);
router.use(authorize('student'));

// Task routes
router.get('/tasks', getMyTasks);
router.post('/tasks/submit', submitTask);

// Free period suggestions
router.get('/free-period-suggestions', getFreePeriodSuggestions);
router.post('/free-period-tasks/complete', markTaskComplete);
router.get('/free-period-tasks/completed', getCompletedTasks);
router.get('/free-period-tasks/stats', getTaskStats);

module.exports = router;