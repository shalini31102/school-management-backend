// routes/student.js
const express = require('express');
const router = express.Router();
const {
  getMyTasks,
  submitTask,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and student role
router.use(protect);
router.use(authorize('student'));

// Task routes
router.get('/tasks', getMyTasks);
router.post('/tasks/submit', submitTask);

module.exports = router;