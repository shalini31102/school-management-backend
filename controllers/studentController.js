// controllers/studentController.js
const { Task, TaskSubmission, Student } = require('../models');

/**
 * @desc    Get tasks assigned to student
 * @route   GET /api/student/tasks
 * @access  Private (Student)
 */
const getMyTasks = async (req, res) => {
  try {
    const studentId = req.user.profileId;

    // Get all tasks assigned to this student
    const tasks = await Task.find({
      assignedTo: studentId,
      isActive: true,
    })
      .populate('assignedBy', 'name')
      .sort({ dueDate: 1 })
      .limit(100);

    // Get submissions for these tasks
    const taskIds = tasks.map(t => t._id);
    const submissions = await TaskSubmission.find({
      taskId: { $in: taskIds },
      studentId: studentId,
    });

    // Merge tasks with their submissions
    const tasksWithSubmissions = tasks.map(task => {
      const submission = submissions.find(s => 
        s.taskId.toString() === task._id.toString()
      );

      return {
        ...task.toObject(),
        submission: submission || null,
      };
    });

    res.status(200).json({
      success: true,
      count: tasksWithSubmissions.length,
      data: tasksWithSubmissions,
    });
  } catch (error) {
    console.error('Get student tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message,
    });
  }
};

/**
 * @desc    Submit task
 * @route   POST /api/student/tasks/submit
 * @access  Private (Student)
 */
const submitTask = async (req, res) => {
  try {
    const { taskId, studentId, submissionText } = req.body;

    if (!taskId || !studentId || !submissionText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Check if already submitted
    const existingSubmission = await TaskSubmission.findOne({
      taskId,
      studentId,
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted this task',
      });
    }

    // Create submission
    const submission = await TaskSubmission.create({
      taskId,
      studentId,
      submissionText,
      submittedAt: new Date(),
      status: 'submitted',
      isLate: new Date() > task.dueDate,
    });

    res.status(201).json({
      success: true,
      message: 'Task submitted successfully',
      data: submission,
    });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting task',
      error: error.message,
    });
  }
};

module.exports = {
  getMyTasks,
  submitTask,
};