// controllers/teacherController.js
const Groq = require('groq-sdk');
const { Student, Attendance, Task, TaskSubmission, Timetable, ClassFreePeriodSession } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');
const notificationService = require('../utils/notificationService');

// ── UTC date helper ────────────────────────────────────────────────────────────
const utcToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
};

/**
 * @desc    Mark attendance by scanning QR code
 * @route   POST /api/teacher/attendance/scan-qr
 * @access  Private (Teacher)
 */
const scanQRAttendance = asyncHandler(async (req, res) => {
  const { qrCode, teacherId } = req.body;
  if (!qrCode || !teacherId) {
    return error(res, 400, 'QR code and teacher ID are required');
  }

  const student = await Student.findOne({ qrCode }).lean();
  if (!student) return error(res, 404, 'Invalid QR code. Student not found.');

  const todayDate = utcToday();

  const existingAttendance = await Attendance.findOne({ studentId: student._id, date: todayDate }).lean();
  if (existingAttendance) {
    return error(res, 400, `Attendance already marked for ${student.name} today.`);
  }

  const attendance = await Attendance.create({
    studentId: student._id,
    class:      student.class,
    section:    student.section,
    date:       todayDate,
    status:     'present',
    markedBy:   teacherId,
    scanMethod: 'qr',
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`class:${student.class}-${student.section}`).emit('attendance-marked', {
      type:        'single',
      studentId:   student._id,
      studentName: student.name,
      rollNumber:  student.rollNumber,
      status:      'present',
      date:        attendance.date,
      class:       student.class,
      section:     student.section,
      markedBy:    teacherId,
    });
  }

  return success(res, 201, 'Attendance marked successfully', {
    student:    { name: student.name, rollNumber: student.rollNumber, class: student.class, section: student.section },
    attendance,
  });
});

/**
 * @desc    Get attendance history for a class
 * @route   GET /api/teacher/attendance/history/:class/:section
 * @access  Private (Teacher)
 */
const getAttendanceHistory = asyncHandler(async (req, res) => {
  const { class: className, section } = req.params;
  const { date } = req.query;

  let queryDate;
  if (date) {
    const [year, month, day] = date.split('-').map(Number);
    queryDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  } else {
    queryDate = utcToday();
  }

  const attendance = await Attendance.find({ class: className, section, date: queryDate })
    .populate('studentId', 'name rollNumber')
    .lean();

  return success(res, 200, 'Attendance fetched', attendance, { count: attendance.length });
});

/**
 * @desc    Get students in a class with today's attendance status
 * @route   GET /api/teacher/students/:class/:section
 * @access  Private (Teacher)
 */
const getClassStudents = asyncHandler(async (req, res) => {
  const { class: className, section } = req.params;
  const todayDate = utcToday();

  // Two parallel queries — no N+1
  const [students, todayAttendance] = await Promise.all([
    Student.find({ class: className, section, isActive: true })
      .select('name rollNumber class section')
      .lean(),
    Attendance.find({ class: className, section, date: todayDate })
      .select('studentId status')
      .lean(),
  ]);

  const attendanceMap = new Map(todayAttendance.map((a) => [a.studentId.toString(), a.status]));

  const studentsWithAttendance = students.map((s) => ({
    ...s,
    todayAttendance: attendanceMap.get(s._id.toString()) || null,
  }));

  return success(res, 200, 'Students fetched', studentsWithAttendance, { count: students.length });
});

/**
 * @desc    Mark attendance for multiple students
 * @route   POST /api/teacher/attendance/mark-multiple
 * @access  Private (Teacher)
 */
const markMultipleAttendance = asyncHandler(async (req, res) => {
  const { teacherId, attendance } = req.body;
  if (!teacherId || !Array.isArray(attendance) || attendance.length === 0) {
    return error(res, 400, 'Invalid data provided');
  }

  const todayDate = utcToday();
  const studentIds = attendance.map((r) => r.studentId);

  // Batch fetch all students + existing records in parallel — eliminates N+1
  const [students, existingRecords] = await Promise.all([
    Student.find({ _id: { $in: studentIds } }).select('class section').lean(),
    Attendance.find({ studentId: { $in: studentIds }, date: todayDate }).select('studentId').lean(),
  ]);

  const studentMap  = new Map(students.map((s) => [s._id.toString(), s]));
  const existingSet = new Set(existingRecords.map((r) => r.studentId.toString()));

  const errors = [];
  const ops = [];

  for (const record of attendance) {
    const sid = record.studentId.toString();
    const student = studentMap.get(sid);
    if (!student) {
      errors.push(`Student ${record.studentId} not found`);
      continue;
    }

    ops.push({
      updateOne: {
        filter: { studentId: record.studentId, date: todayDate },
        update: {
          $set: {
            class:      student.class,
            section:    student.section,
            status:     record.status,
            markedBy:   teacherId,
            scanMethod: 'manual',
          },
        },
        upsert: true,
      },
    });
  }

  let marked = 0;
  if (ops.length > 0) {
    const result = await Attendance.bulkWrite(ops);
    marked = (result.upsertedCount || 0) + (result.modifiedCount || 0);

    const io = req.app.get('io');
    if (io && students.length > 0) {
      const { class: cls, section: sec } = students[0];
      io.to(`class:${cls}-${sec}`).emit('attendance-marked', {
        type:    'bulk',
        count:   marked,
        date:    todayDate,
        class:   cls,
        section: sec,
        records: attendance.map((r) => ({ studentId: r.studentId, status: r.status })),
      });
    }
  }

  return success(res, 201, `Attendance marked for ${marked} students`, {
    marked,
    errors: errors.length > 0 ? errors : undefined,
  });
});

/**
 * @desc    Assign task to class
 * @route   POST /api/teacher/tasks/assign
 * @access  Private (Teacher)
 */
const assignTask = asyncHandler(async (req, res) => {
  const {
    title, description, subject, dueDate, totalMarks,
    difficulty, instructions, teacherId, targetClass, targetSection,
  } = req.body;

  if (!title || !description || !subject || !dueDate || !teacherId || !targetClass || !targetSection) {
    return error(res, 400, 'Please provide all required fields');
  }

  const studentIds = await Student.find({ class: targetClass, section: targetSection, isActive: true })
    .distinct('_id');

  if (studentIds.length === 0) return error(res, 404, 'No students found in this class');

  const task = await Task.create({
    title,
    description,
    type:          'assignment',
    subject,
    assignedBy:    teacherId,
    assignedTo:    studentIds,
    targetClass,
    targetSection,
    dueDate:       new Date(dueDate),
    totalMarks:    totalMarks    || 10,
    difficulty:    difficulty    || 'medium',
    instructions:  instructions  || undefined,
    isPersonalized: false,
    isForFreePeriod: false,
  });

  // Fire-and-forget notification (don't block the response)
  notificationService.notifyTaskAssigned(studentIds, task).catch(() => {});

  return success(res, 201, 'Task assigned successfully', { task, studentsCount: studentIds.length });
});

/**
 * @desc    Get tasks assigned by teacher
 * @route   GET /api/teacher/tasks/my-tasks
 * @access  Private (Teacher)
 */
const getMyTasks = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;

  // Single aggregation — eliminates N+1 (was: N separate countDocuments calls)
  const tasks = await Task.aggregate([
    { $match: { assignedBy: teacherId, isActive: true } },
    { $sort: { createdAt: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from:         'tasksubmissions',
        localField:   '_id',
        foreignField: 'taskId',
        as:           '_submissions',
      },
    },
    {
      $addFields: {
        'stats.totalAssigned': { $size: '$assignedTo' },
        'stats.submissions':   { $size: '$_submissions' },
        'stats.pending': {
          $subtract: [{ $size: '$assignedTo' }, { $size: '$_submissions' }],
        },
      },
    },
    { $project: { _submissions: 0 } },
  ]);

  return success(res, 200, 'Tasks fetched', tasks, { count: tasks.length });
});

/**
 * @desc    Get today's attendance count for a class
 * @route   GET /api/teacher/attendance/today/:class/:section
 * @access  Private (Teacher)
 */
const getTodayAttendanceCount = asyncHandler(async (req, res) => {
  const { class: className, section } = req.params;
  const todayDate = utcToday();

  const records = await Attendance.find({
    class:   className,
    section: section.toUpperCase(),
    date:    todayDate,
  })
    .populate('studentId', 'name rollNumber')
    .lean();

  const present = records.filter((r) => r.status === 'present' || r.status === 'late');
  const recentlyMarked = [...records]
    .sort((a, b) => b.markedAt - a.markedAt)
    .slice(0, 5)
    .map((r) => ({
      name:       r.studentId?.name || 'Unknown',
      rollNumber: r.studentId?.rollNumber,
      status:     r.status,
      markedAt:   r.markedAt,
    }));

  return success(res, 200, 'Attendance count fetched', {
    total:          records.length,
    present:        present.length,
    recentlyMarked,
  });
});

/**
 * @desc    Get classes that currently have a free period
 * @route   GET /api/teacher/free-periods/current
 * @access  Private (Teacher)
 */
const getCurrentFreePeriods = asyncHandler(async (req, res) => {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today       = days[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const timetables = await Timetable.find({ isActive: true }).lean();

  // Find free-period classes in memory (no DB queries in loop)
  const freePeriodClasses = [];
  for (const tt of timetables) {
    const daySchedule = tt.schedule.find((s) => s.day === today);
    if (!daySchedule) continue;
    const freePeriod = daySchedule.periods.find(
      (p) => p.isFree && !p.isBreak && p.startTime <= currentTime && p.endTime > currentTime
    );
    if (freePeriod) {
      freePeriodClasses.push({ class: tt.class, section: tt.section, period: freePeriod });
    }
  }

  if (freePeriodClasses.length === 0) {
    return success(res, 200, 'No active free periods', []);
  }

  // Single aggregation to count students per class/section — eliminates N+1
  const classSectionPairs = freePeriodClasses.map((f) => ({ class: f.class, section: f.section }));
  const counts = await Student.aggregate([
    { $match: { isActive: true, $or: classSectionPairs } },
    { $group: { _id: { class: '$class', section: '$section' }, studentCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(
    counts.map((c) => [`${c._id.class}-${c._id.section}`, c.studentCount])
  );

  const result = freePeriodClasses.map((f) => ({
    class:  f.class,
    section: f.section,
    period: {
      subject:   f.period.subject,
      startTime: f.period.startTime,
      endTime:   f.period.endTime,
    },
    studentCount: countMap.get(`${f.class}-${f.section}`) || 0,
  }));

  return success(res, 200, 'Free periods fetched', result);
});

/**
 * @desc    Update student academic profile (teacher — restricted fields only)
 * @route   PATCH /api/teacher/students/:id/academic
 * @access  Private (Teacher)
 */
const updateStudentAcademicProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const forbidden = [
    'name', 'class', 'section', 'rollNumber', 'email', 'userId',
    'qrCode', 'isActive', 'parentContact', 'address', 'dateOfBirth', 'gender',
  ];
  for (const field of forbidden) {
    if (req.body[field] !== undefined) {
      return error(res, 403, `Field '${field}' cannot be updated by teacher`);
    }
  }

  const allowed = ['performanceLevel', 'learningPace', 'interests', 'careerGoals'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const student = await Student.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!student) return error(res, 404, 'Student not found');

  return success(res, 200, 'Academic profile updated', student);
});

/**
 * @desc    Get student profile with academic fields
 * @route   GET /api/teacher/students/:id/profile
 * @access  Private (Teacher)
 */
const getStudentProfile = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id)
    .select('name rollNumber class section performanceLevel learningPace interests careerGoals gender dateOfBirth')
    .lean();
  if (!student) return error(res, 404, 'Student not found');
  return success(res, 200, 'Student profile fetched', student);
});

/**
 * @desc    Teacher starts a free period session for their class
 * @route   POST /api/teacher/free-period/start
 * @access  Private (Teacher)
 */
const startFreePeriodSession = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;
  const { class: className, section, duration, missedSubject, note } = req.body;

  if (!className || !section || !duration) {
    return error(res, 400, 'class, section, and duration are required');
  }

  // Deactivate any existing session for this class
  await ClassFreePeriodSession.updateMany(
    { class: className, section: section.toUpperCase(), isActive: true },
    { isActive: false }
  );

  // Generate class-specific AI tasks
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const userPrompt = `Class ${className}-${section} has a ${duration}-minute free period.
${missedSubject ? `The missed subject is: ${missedSubject}.` : ''}
${note ? `Teacher note: ${note}` : ''}
Generate 6 study tasks specifically for this class and duration.
Each task must be completable in ${Math.floor(duration * 0.8)} minutes or less.

Return JSON:
{
  "tasks": [
    {
      "title": "task title",
      "description": "what students should do",
      "subject": "${missedSubject || 'General'}",
      "estimatedTime": 20,
      "difficulty": "medium",
      "matchReason": "why this task is good for this free period"
    }
  ]
}`;

  let tasks = [];
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an educational AI. Respond with valid JSON only.' },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1200,
    });
    const parsed = JSON.parse(response.choices[0].message.content);
    tasks = (parsed.tasks || []).slice(0, 6);
  } catch (err) {
    console.error('[startFreePeriodSession] AI error:', err.message);
    tasks = [];
  }

  const endsAt = new Date(Date.now() + duration * 60 * 1000);
  const session = await ClassFreePeriodSession.create({
    teacherId,
    class:         className,
    section:       section.toUpperCase(),
    duration,
    missedSubject: missedSubject || undefined,
    note:          note || undefined,
    tasks,
    endsAt,
    isActive: true,
  });

  // Emit socket event to the class room
  const io = req.app.get('io');
  if (io) {
    io.to(`class:${className}-${section.toUpperCase()}`).emit('free-period-started', {
      sessionId:     session._id,
      duration,
      missedSubject: missedSubject || null,
      note:          note || null,
      endsAt,
      taskCount:     tasks.length,
    });
  }

  return success(res, 201, 'Free period session started', session);
});

/**
 * @desc    Teacher ends an active free period session
 * @route   POST /api/teacher/free-period/end
 * @access  Private (Teacher)
 */
const endFreePeriodSession = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;
  const { class: className, section } = req.body;

  if (!className || !section) return error(res, 400, 'class and section are required');

  const result = await ClassFreePeriodSession.updateMany(
    { teacherId, class: className, section: section.toUpperCase(), isActive: true },
    { isActive: false }
  );

  const io = req.app.get('io');
  if (io) {
    io.to(`class:${className}-${section.toUpperCase()}`).emit('free-period-ended', { class: className, section });
  }

  return success(res, 200, 'Free period session ended', { modifiedCount: result.modifiedCount });
});

/**
 * @desc    Get active free period session for a class
 * @route   GET /api/teacher/free-period/active?class=10&section=A
 * @access  Private (Teacher)
 */
const getActiveFreePeriodSession = asyncHandler(async (req, res) => {
  const { class: className, section } = req.query;
  if (!className || !section) return error(res, 400, 'class and section are required');

  const session = await ClassFreePeriodSession.findOne({
    class:    className,
    section:  section.toUpperCase(),
    isActive: true,
    endsAt:   { $gt: new Date() },
  }).lean();

  return success(res, 200, 'Active session fetched', session || null);
});

/**
 * @desc    Get free period session history for teacher's class
 * @route   GET /api/teacher/free-period/history
 * @access  Private (Teacher)
 */
const getSessionHistory = asyncHandler(async (req, res) => {
  const teacherId = req.user.profileId;

  const sessions = await ClassFreePeriodSession.find({ teacherId })
    .sort({ startedAt: -1 })
    .limit(10)
    .lean();

  return success(res, 200, 'Session history fetched', sessions, { count: sessions.length });
});

module.exports = {
  scanQRAttendance,
  getAttendanceHistory,
  getClassStudents,
  markMultipleAttendance,
  assignTask,
  getMyTasks,
  getTodayAttendanceCount,
  getCurrentFreePeriods,
  updateStudentAcademicProfile,
  getStudentProfile,
  startFreePeriodSession,
  endFreePeriodSession,
  getActiveFreePeriodSession,
  getSessionHistory,
};
