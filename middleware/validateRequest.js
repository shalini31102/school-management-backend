// middleware/validateRequest.js
/**
 * Centralised express-validator rule sets.
 *
 * Import individual arrays into route files instead of repeating them inline:
 *   const { studentValidation } = require('../middleware/validateRequest');
 *   router.post('/students/add', studentValidation.addStudent, validate, addStudent);
 */
const { body, param } = require('express-validator');

// ── Student ───────────────────────────────────────────────────────────────────
const studentValidation = {
  addStudent: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Student name is required'),
    body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
    body('class').trim().notEmpty().withMessage('Class is required'),
    body('section').trim().notEmpty().withMessage('Section is required'),
  ],
  updateStudent: [
    param('id').isMongoId().withMessage('Invalid student ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('class').optional().trim().notEmpty().withMessage('Class cannot be empty'),
    body('section').optional().trim().notEmpty().withMessage('Section cannot be empty'),
    body('rollNumber').optional().trim().notEmpty().withMessage('Roll number cannot be empty'),
    body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  ],
};

// ── Teacher ───────────────────────────────────────────────────────────────────
const teacherValidation = {
  addTeacher: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Teacher name is required'),
    body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
    body('contactNumber').matches(/^[0-9]{10}$/).withMessage('Contact number must be 10 digits'),
    body('subjects').optional().isArray().withMessage('Subjects must be an array'),
    body('experience').optional().isNumeric({ min: 0 }).withMessage('Experience must be a non-negative number'),
    body('isClassTeacher').optional().isBoolean(),
    body('assignedClass').optional().trim(),
    body('assignedSection').optional().trim(),
  ],
  updateTeacher: [
    param('id').isMongoId().withMessage('Invalid teacher ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('contactNumber').optional().matches(/^[0-9]{10}$/).withMessage('Contact number must be 10 digits'),
    body('subjects').optional().isArray().withMessage('Subjects must be an array'),
    body('experience').optional().isNumeric({ min: 0 }).withMessage('Experience must be a non-negative number'),
    body('isClassTeacher').optional().isBoolean(),
    body('assignedClass').optional().trim(),
    body('assignedSection').optional().trim(),
    body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  ],
  assignTask: [
    body('title').trim().notEmpty().withMessage('Task title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    body('targetClass').trim().notEmpty().withMessage('Target class is required'),
    body('targetSection').trim().notEmpty().withMessage('Target section is required'),
  ],
};

// ── Admin ─────────────────────────────────────────────────────────────────────
const adminValidation = {
  createAdmin: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('employeeId').trim().notEmpty().withMessage('Employee ID is required'),
  ],
};

// ── Auth ──────────────────────────────────────────────────────────────────────
const authValidation = {
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
};

// ── Student self-service ──────────────────────────────────────────────────────
const studentSelfValidation = {
  submitTask: [
    body('taskId').isMongoId().withMessage('Valid task ID is required'),
    body('studentId').isMongoId().withMessage('Valid student ID is required'),
    body('submissionText').trim().notEmpty().withMessage('Submission text is required'),
  ],
  updateProfile: [
    body('interests').optional().isArray().withMessage('Interests must be an array'),
    body('careerGoals').optional().isArray().withMessage('Career goals must be an array'),
    body('learningPace').optional().isIn(['slow', 'medium', 'fast']).withMessage('Invalid learning pace'),
  ],
};

module.exports = {
  studentValidation,
  teacherValidation,
  adminValidation,
  authValidation,
  studentSelfValidation,
};
