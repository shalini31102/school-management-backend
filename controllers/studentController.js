// controllers/studentController.js
const { Task, TaskSubmission, Student, Attendance, Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');

/**
 * @desc    Get tasks assigned to the logged-in student
 * @route   GET /api/student/tasks
 * @access  Private (Student)
 */
const getMyTasks = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;

  // Fetch tasks + matching submissions in two parallel queries (no N+1)
  const tasks = await Task.find({ assignedTo: studentId, isActive: true })
    .populate('assignedBy', 'name')
    .sort({ dueDate: 1 })
    .limit(100)
    .lean();

  const taskIds     = tasks.map((t) => t._id);
  const submissions = await TaskSubmission.find({
    taskId:    { $in: taskIds },
    studentId,
  }).lean();

  const submissionMap = new Map(submissions.map((s) => [s.taskId.toString(), s]));

  const tasksWithSubmissions = tasks.map((task) => ({
    ...task,
    submission: submissionMap.get(task._id.toString()) || null,
  }));

  return success(res, 200, 'Tasks fetched', tasksWithSubmissions, { count: tasksWithSubmissions.length });
});

/**
 * @desc    Submit a task
 * @route   POST /api/student/tasks/submit
 * @access  Private (Student)
 */
const submitTask = asyncHandler(async (req, res) => {
  const { taskId, studentId, submissionText } = req.body;

  if (!taskId || !studentId || !submissionText) {
    return error(res, 400, 'Please provide taskId, studentId, and submissionText');
  }

  const task = await Task.findById(taskId).lean();
  if (!task) return error(res, 404, 'Task not found');

  const existing = await TaskSubmission.findOne({ taskId, studentId }).lean();
  if (existing) return error(res, 400, 'You have already submitted this task');

  const submission = await TaskSubmission.create({
    taskId,
    studentId,
    submissionText,
    submittedAt: new Date(),
    status: 'submitted',
    isLate: new Date() > task.dueDate,
  });

  return success(res, 201, 'Task submitted successfully', submission);
});

/**
 * @desc    Get own student profile
 * @route   GET /api/student/profile
 * @access  Private (Student)
 */
const getOwnProfile = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;
  const student   = await Student.findById(studentId).populate('userId', 'email').lean();
  if (!student) return error(res, 404, 'Profile not found');
  return success(res, 200, 'Profile fetched', student);
});

/**
 * @desc    Update own profile (interests, careerGoals, learningPace only)
 * @route   PATCH /api/student/profile
 * @access  Private (Student)
 */
const updateOwnProfile = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;

  const forbidden = [
    'name', 'class', 'section', 'rollNumber', 'email', 'userId',
    'qrCode', 'isActive', 'performanceLevel', 'parentContact',
    'address', 'dateOfBirth', 'gender',
  ];
  for (const field of forbidden) {
    if (req.body[field] !== undefined) {
      return error(res, 403, `Field '${field}' cannot be updated`);
    }
  }

  const allowed = ['interests', 'careerGoals', 'learningPace'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const student = await Student.findByIdAndUpdate(studentId, updates, { new: true, runValidators: true });
  if (!student) return error(res, 404, 'Profile not found');

  return success(res, 200, 'Profile updated', student);
});

/**
 * @desc    Get attendance stats for the logged-in student (last 30 days)
 * @route   GET /api/student/attendance/stats
 * @access  Private (Student)
 */
const getAttendanceStats = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);

  const records = await Attendance.find({
    studentId,
    date: { $gte: start, $lte: end },
  }).lean();

  const total = records.length;
  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const rate = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : null;

  return success(res, 200, 'Attendance stats fetched', { total, present, absent, rate });
});

/**
 * @desc    Get attendance records for a specific month
 * @route   GET /api/student/attendance/history?month=3&year=2026
 * @access  Private (Student)
 */
const getAttendanceHistory = asyncHandler(async (req, res) => {
  const studentId = req.user.profileId;
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
  const year  = parseInt(req.query.year, 10)  || new Date().getFullYear();

  if (month < 1 || month > 12) return error(res, 400, 'month must be 1–12');

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const records = await Attendance.find({
    studentId,
    date: { $gte: start, $lte: end },
  })
    .sort({ date: 1 })
    .lean();

  const total   = records.length;
  const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absent  = total - present;
  const rate    = total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : null;

  return success(res, 200, 'Attendance history fetched', {
    month,
    year,
    records,
    stats: { total, present, absent, rate },
  });
});

/**
 * @desc    Get notifications for the logged-in student
 * @route   GET /api/student/notifications
 * @access  Private (Student)
 */
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notifications = await Notification.find({ userId })
    .sort({ isRead: 1, createdAt: -1 })
    .limit(50)
    .lean();
  return success(res, 200, 'Notifications fetched', notifications, { count: notifications.length });
});

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/student/notifications/:id/read
 * @access  Private (Student)
 */
const markNotificationRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId },
    { isRead: true },
    { new: true }
  ).lean();
  if (!notif) return error(res, 404, 'Notification not found');
  return success(res, 200, 'Marked as read', notif);
});

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/student/notifications/read-all
 * @access  Private (Student)
 */
const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return success(res, 200, 'All notifications marked as read');
});

/**
 * @desc    Get unread notification count
 * @route   GET /api/student/notifications/unread-count
 * @access  Private (Student)
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const count = await Notification.countDocuments({ userId, isRead: false });
  return success(res, 200, 'Unread count fetched', { count });
});

module.exports = {
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
};
