// socket/index.js
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const { User, Student, Timetable, Task, TaskSubmission, Notification, ClassFreePeriodSession } = require('../models');
const { generateAISuggestions, generateDailyPlanForStudent } = require('../controllers/freePeriodController');
const notificationService = require('../utils/notificationService');

// ── In-memory tracking ──────────────────────────────────────────────────────
const connectedStudents = new Map(); // profileId → socketId
const connectedUsers    = new Map(); // userId → socketId
const notifiedPeriods   = new Map(); // profileId → period key

// ── Socket auth middleware ───────────────────────────────────────────────────
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('User not found'));
    if (!user.isActive) return next(new Error('Account is deactivated'));

    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
};

// ── Cron: free-period detection (every minute) ───────────────────────────────
const startFreePeriodCron = (io) => {
  cron.schedule('* * * * *', async () => {
    if (connectedStudents.size === 0) return;

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today       = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const [profileId, socketId] of connectedStudents) {
      try {
        const student = await Student.findById(profileId);
        if (!student) continue;

        const timetable = await Timetable.findOne({ class: student.class, section: student.section, isActive: true });
        if (!timetable) continue;

        const todaySchedule = timetable.schedule.find((s) => s.day === today);
        if (!todaySchedule) continue;

        const freePeriod = todaySchedule.periods.find(
          (p) => p.isFree === true && currentTime >= p.startTime && currentTime <= p.endTime
        );
        if (!freePeriod) continue;

        const periodKey = `${today}-${freePeriod.startTime}`;
        if (notifiedPeriods.get(profileId) === periodKey) continue;
        notifiedPeriods.set(profileId, periodKey);

        console.log(`📚 Free period detected for ${student.name} → generating suggestions…`);

        const suggestions = await generateAISuggestions(student, freePeriod.subject || null);

        io.to(socketId).emit('free-period-detected', {
          period: {
            periodNumber: freePeriod.periodNumber,
            startTime:    freePeriod.startTime,
            endTime:      freePeriod.endTime,
            subject:      freePeriod.subject || null,
          },
          suggestions,
        });

        console.log(`   ✅ Emitted to ${student.name} (${student.class}-${student.section})`);
      } catch (err) {
        console.error(`Cron: error for student ${profileId}:`, err.message);
      }
    }
  });
};

// ── Cron: daily study plans at 7:00 AM ───────────────────────────────────────
const startDailyPlanCron = (io) => {
  cron.schedule('0 7 * * 1-6', async () => {
    console.log('🤖 [DailyPlanCron] Generating study plans for all active students…');
    try {
      const students = await Student.find({ isActive: true }).lean();
      let generated = 0;
      for (const student of students) {
        try {
          await generateDailyPlanForStudent(student);
          // Notify the student if they have a userId
          if (student.userId) {
            await notificationService.notifyDailyPlanReady(student.userId);
          }
          generated++;
        } catch (err) {
          console.error(`[DailyPlanCron] Error for ${student.name}:`, err.message);
        }
        // Small delay to avoid hammering Groq API
        await new Promise((r) => setTimeout(r, 500));
      }
      console.log(`   ✅ Generated plans for ${generated}/${students.length} students`);
    } catch (err) {
      console.error('[DailyPlanCron] Fatal error:', err.message);
    }
  });
};

// ── Cron: deadline warnings at 8:00 AM ───────────────────────────────────────
const startDeadlineWarningCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ [DeadlineWarningCron] Checking tasks due in 24 hours…');
    try {
      const now      = new Date();
      const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tasksDue = await Task.find({ dueDate: { $gte: now, $lte: in24h }, isActive: true }).lean();

      let count = 0;
      for (const task of tasksDue) {
        // Find students who haven't submitted yet
        const submittedIds = await TaskSubmission.find({ taskId: task._id }).distinct('studentId');
        const submittedSet = new Set(submittedIds.map(String));
        const pending = task.assignedTo.filter((id) => !submittedSet.has(String(id)));

        if (pending.length === 0) continue;

        const { Student } = require('../models');
        const students = await Student.find({ _id: { $in: pending } }).select('userId').lean();

        for (const s of students) {
          if (!s.userId) continue;
          await notificationService.createNotification(
            s.userId,
            '⏰ Deadline Tomorrow',
            `Task "${task.title}" is due ${new Date(task.dueDate).toLocaleDateString()} — don't forget to submit!`,
            'deadline_warning',
            { taskId: task._id }
          ).catch(() => {});
          count++;
        }
      }
      console.log(`   ✅ Sent ${count} deadline warnings`);
    } catch (err) {
      console.error('[DeadlineWarningCron] Error:', err.message);
    }
  });
};

// ── Cron: auto-end expired free period sessions every 5 minutes ──────────────
const startSessionCleanupCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await ClassFreePeriodSession.updateMany(
        { isActive: true, endsAt: { $lt: new Date() } },
        { isActive: false }
      );
      if (result.modifiedCount > 0) {
        console.log(`[SessionCleanup] Auto-ended ${result.modifiedCount} expired free period session(s)`);
      }
    } catch (err) {
      console.error('[SessionCleanup] Error:', err.message);
    }
  });
};

// ── Main setup function ──────────────────────────────────────────────────────
const setupSocket = (io) => {
  // Pass io to notification service so it can push real-time notifications
  notificationService.setIo(io);

  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const { user } = socket;
    console.log(`🔌 Socket connected: ${socket.id} [${user.role}: ${user.email}]`);

    // Register user for notifications
    notificationService.registerUser(user._id, socket.id);
    connectedUsers.set(user._id.toString(), socket.id);

    socket.join(`role:${user.role}`);

    if (user.role === 'student') {
      try {
        const student = await Student.findById(user.profileId);
        if (student) {
          const classRoom = `class:${student.class}-${student.section}`;
          socket.join(classRoom);
          connectedStudents.set(user.profileId.toString(), socket.id);
          console.log(`   joined ${classRoom}`);
        }
      } catch (err) {
        console.error('Socket: could not resolve student profile:', err.message);
      }
    }

    socket.on('join', (room) => {
      socket.join(room);
      console.log(`   ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      if (user.role === 'student') {
        const id = user.profileId.toString();
        connectedStudents.delete(id);
        notifiedPeriods.delete(id);
      }
      connectedUsers.delete(user._id.toString());
      notificationService.unregisterUser(user._id);
      console.log(`🔌 Socket disconnected: ${socket.id} [${user.role}]`);
    });
  });

  startFreePeriodCron(io);
  startDailyPlanCron(io);
  startDeadlineWarningCron();
  startSessionCleanupCron();
};

module.exports = { setupSocket };
