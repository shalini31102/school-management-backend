// controllers/customTaskController.js
const { CustomFreePeriodTask } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');

/**
 * @desc    Create a custom free-period task
 * @route   POST /api/teacher/custom-tasks/create
 * @access  Private (Teacher)
 */
const createCustomTask = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;
  const {
    title,
    description,
    targetClass,
    targetSection,
    targetStudents,
    category,
    difficulty,
    subject,
    estimatedTime,
    resources,
    instructions,
    matchingCriteria,
  } = req.body;

  if (!title || !description || !difficulty || !estimatedTime) {
    return error(res, 400, 'Missing required fields: title, description, difficulty, estimatedTime');
  }

  const customTask = await CustomFreePeriodTask.create({
    title,
    description,
    createdBy: teacherId,
    targetClass:      targetClass      || undefined,
    targetSection:    targetSection    || undefined,
    targetStudents:   targetStudents   || [],
    category:         category         || 'general',
    difficulty,
    subject:          subject          || 'General',
    estimatedTime,
    resources:        resources        || [],
    instructions:     instructions     || undefined,
    matchingCriteria: matchingCriteria || {},
  });

  return success(res, 201, 'Custom task created successfully!', customTask);
});

/**
 * @desc    Get teacher's custom tasks
 * @route   GET /api/teacher/custom-tasks
 * @access  Private (Teacher)
 */
const getMyCustomTasks = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;

  const tasks = await CustomFreePeriodTask.find({ createdBy: teacherId, isActive: true })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return success(res, 200, 'Custom tasks fetched', tasks, { count: tasks.length });
});

/**
 * @desc    Soft-delete a custom task
 * @route   DELETE /api/teacher/custom-tasks/:id
 * @access  Private (Teacher)
 */
const deleteCustomTask = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;
  const task = await CustomFreePeriodTask.findOne({ _id: req.params.id, createdBy: teacherId });
  if (!task) return error(res, 404, 'Task not found or unauthorized');

  task.isActive = false;
  await task.save();
  return success(res, 200, 'Task deleted successfully');
});

module.exports = { createCustomTask, getMyCustomTasks, deleteCustomTask };
