// utils/notificationService.js
const { Notification } = require('../models');

let _io = null;
// userId string → socketId
const _connectedUsers = new Map();

const setIo = (io) => { _io = io; };
const registerUser   = (userId, socketId) => _connectedUsers.set(String(userId), socketId);
const unregisterUser = (userId) => _connectedUsers.delete(String(userId));

/**
 * Create a notification in DB and push to socket if user is online.
 */
const createNotification = async (userId, title, message, type, data = {}) => {
  try {
    const notification = await Notification.create({ userId, title, message, type, data });
    if (_io) {
      const socketId = _connectedUsers.get(String(userId));
      if (socketId) {
        _io.to(socketId).emit('notification', {
          _id:       notification._id,
          title,
          message,
          type,
          data,
          isRead:    false,
          createdAt: notification.createdAt,
        });
      }
    }
    return notification;
  } catch (err) {
    console.error('[NotificationService] createNotification error:', err.message);
  }
};

/**
 * Notify all students of a class when a task is assigned.
 */
const notifyTaskAssigned = async (studentIds, task) => {
  const { Student } = require('../models');
  const students = await Student.find({ _id: { $in: studentIds } }).select('userId').lean();
  await Promise.all(
    students.map((s) =>
      createNotification(
        s.userId,
        'New Task Assigned 📝',
        `"${task.title}" — due ${new Date(task.dueDate).toLocaleDateString()}`,
        'task_assigned',
        { taskId: task._id }
      )
    )
  );
};

/**
 * Notify a student when their submission is graded.
 */
const notifyTaskGraded = async (studentId, taskTitle, score, totalMarks) => {
  const { Student } = require('../models');
  const student = await Student.findById(studentId).select('userId').lean();
  if (!student) return;
  await createNotification(
    student.userId,
    'Task Graded 🎓',
    `Your submission for "${taskTitle}" was graded: ${score}/${totalMarks}`,
    'task_graded',
    { score, totalMarks }
  );
};

/**
 * Notify a student that their daily AI study plan is ready.
 */
const notifyDailyPlanReady = async (studentUserId) => {
  await createNotification(
    studentUserId,
    '🤖 Study Plan Ready',
    'Your AI-powered daily study plan has been generated. Check it out!',
    'daily_plan_ready',
    {}
  );
};

module.exports = {
  setIo,
  registerUser,
  unregisterUser,
  createNotification,
  notifyTaskAssigned,
  notifyTaskGraded,
  notifyDailyPlanReady,
};
