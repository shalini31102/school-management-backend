// routes/admin.js
const express = require('express');
const router = express.Router();
const {
  addStudent,
  getAllStudents,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Student routes
router.post('/students/add', addStudent);
router.get('/students', getAllStudents);

module.exports = router;