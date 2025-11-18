// controllers/customTaskController.js
const { CustomFreePeriodTask, Student } = require('../models');

/**
 * @desc    Create a custom free period task
 * @route   POST /api/teacher/custom-tasks/create
 * @access  Private (Teacher)
 */
const createCustomTask = async (req, res) => {
  try {
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
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const customTask = await CustomFreePeriodTask.create({
      title,
      description,
      createdBy: teacherId,
      targetClass: targetClass || undefined,
      targetSection: targetSection || undefined,
      targetStudents: targetStudents || [],
      category: category || 'general',
      difficulty,
      subject: subject || 'General',
      estimatedTime,
      resources: resources || [],
      instructions: instructions || undefined,
      matchingCriteria: matchingCriteria || {},
    });

    res.status(201).json({
      success: true,
      message: 'Custom task created successfully!',
      data: customTask,
    });
  } catch (error) {
    console.error('Create custom task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating custom task',
      error: error.message,
    });
  }
};

/**
 * @desc    Get teacher's custom tasks
 * @route   GET /api/teacher/custom-tasks
 * @access  Private (Teacher)
 */
const getMyCustomTasks = async (req, res) => {
  try {
    const teacherId = req.user.profileId;

    const tasks = await CustomFreePeriodTask.find({
      createdBy: teacherId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error('Get custom tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching custom tasks',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a custom task
 * @route   DELETE /api/teacher/custom-tasks/:id
 * @access  Private (Teacher)
 */
const deleteCustomTask = async (req, res) => {
  try {
    const teacherId = req.user.profileId;
    const taskId = req.params.id;

    const task = await CustomFreePeriodTask.findOne({
      _id: taskId,
      createdBy: teacherId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or unauthorized',
      });
    }

    task.isActive = false;
    await task.save();

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete custom task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message,
    });
  }
};

module.exports = {
  createCustomTask,
  getMyCustomTasks,
  deleteCustomTask,
};