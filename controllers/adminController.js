// controllers/adminController.js
const { User, Student, Teacher, Admin, Timetable, Attendance, FreePeriodTaskCompletion } = require('../models');
const { generateStudentQRCode } = require('../utils/qrGenerator');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/apiResponse');
const mongoose = require('mongoose');

/**
 * @desc    Add new student
 * @route   POST /api/admin/students/add
 * @access  Private (Admin)
 */
const addStudent = asyncHandler(async (req, res) => {
  const {
    email, password, name, rollNumber,
    class: className, section, dateOfBirth, gender, parentContact,
  } = req.body;

  if (!email || !password || !name || !rollNumber || !className || !section) {
    return error(res, 400, 'Please provide all required fields');
  }

  // Parallel uniqueness checks
  const [existingUser, existingRoll] = await Promise.all([
    User.findOne({ email }).lean(),
    Student.findOne({ rollNumber }).lean(),
  ]);
  if (existingUser) return error(res, 400, 'Email already exists');
  if (existingRoll)  return error(res, 400, 'Roll number already exists');

  const user = await User.create({
    email,
    password,
    role:      'student',
    profileId: new mongoose.Types.ObjectId(),
  });

  const qrData = await generateStudentQRCode({ _id: user._id, rollNumber, name });

  const student = await Student.create({
    userId:        user._id,
    rollNumber,
    name,
    class:         className,
    section:       section.toUpperCase(),
    qrCode:        qrData.qrString,
    dateOfBirth:   dateOfBirth   || undefined,
    gender:        gender        || 'male',
    parentContact: parentContact || {},
    learningPace:     'medium',
    performanceLevel: 'medium',
  });

  user.profileId = student._id;
  await user.save();

  return success(res, 201, 'Student added successfully', {
    studentId: student._id,
    userId:    user._id,
    name:      student.name,
    rollNumber: student.rollNumber,
    email:     user.email,
    qrCode:    qrData.qrString,
    qrImage:   qrData.qrImage,
  });
});

/**
 * @desc    Get all students
 * @route   GET /api/admin/students
 * @access  Private (Admin)
 */
const getAllStudents = asyncHandler(async (req, res) => {
  const students = await Student.find({ isActive: true })
    .populate('userId', 'email isActive')
    .sort({ class: 1, section: 1, rollNumber: 1 })
    .lean();

  return success(res, 200, 'Students fetched', students, { count: students.length });
});

/**
 * @desc    Create timetable for a class
 * @route   POST /api/admin/timetable/create
 * @access  Private (Admin)
 */
const createTimetable = asyncHandler(async (req, res) => {
  const { class: className, section, schedule } = req.body;

  if (!className || !section || !schedule) {
    return error(res, 400, 'Please provide class, section, and schedule');
  }

  const existingTimetable = await Timetable.findOne({ class: className, section, isActive: true }).lean();
  if (existingTimetable) {
    return error(res, 400, `Timetable already exists for Class ${className}-${section}`);
  }

  const timetable = await Timetable.create({
    class:         className,
    section,
    schedule,
    uploadedBy:    req.user.profileId,
    effectiveFrom: new Date(),
  });

  return success(res, 201, 'Timetable created successfully', timetable);
});

/**
 * @desc    Get timetable for a class
 * @route   GET /api/admin/timetable/:class/:section
 * @access  Private
 */
const getTimetable = asyncHandler(async (req, res) => {
  const { class: className, section } = req.params;

  const timetable = await Timetable.findOne({ class: className, section, isActive: true })
    .populate('uploadedBy', 'name')
    .lean();

  if (!timetable) return error(res, 404, 'Timetable not found for this class');

  return success(res, 200, 'Timetable fetched', timetable);
});

/**
 * @desc    Get admin analytics
 * @route   GET /api/admin/analytics
 * @access  Private (Admin)
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const now          = new Date();
  const todayUTC     = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const sevenDaysAgo = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 6));

  // All sub-queries in a single Promise.all — fully parallel
  const [
    totalStudents,
    totalTeachers,
    todayAgg,
    attendanceTrends,
    topStudents,
    subjectUsage,
    classEngagement,
  ] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    Teacher.countDocuments({ isActive: true }),

    Attendance.aggregate([
      { $match: { date: todayUTC } },
      {
        $group: {
          _id:     null,
          total:   { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        },
      },
    ]),

    Attendance.aggregate([
      { $match: { date: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id:     '$date',
          total:   { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          total: 1,
          present: 1,
          rate: { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] },
        },
      },
    ]),

    FreePeriodTaskCompletion.aggregate([
      { $match: { completedAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$studentId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from:         'students',
          localField:   '_id',
          foreignField: '_id',
          as:           'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:            0,
          name:           '$student.name',
          class:          '$student.class',
          section:        '$student.section',
          tasksCompleted: '$count',
        },
      },
    ]),

    FreePeriodTaskCompletion.aggregate([
      { $match: { subject: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, subject: '$_id', count: 1 } },
    ]),

    FreePeriodTaskCompletion.aggregate([
      { $match: { completedAt: { $gte: sevenDaysAgo } } },
      {
        $lookup: {
          from:         'students',
          localField:   'studentId',
          foreignField: '_id',
          as:           'student',
        },
      },
      { $unwind: '$student' },
      {
        $group: {
          _id:            { class: '$student.class', section: '$student.section' },
          taskCount:      { $sum: 1 },
          activeStudents: { $addToSet: '$studentId' },
        },
      },
      {
        $project: {
          _id:            0,
          class:          '$_id.class',
          section:        '$_id.section',
          taskCount:      1,
          activeStudents: { $size: '$activeStudents' },
        },
      },
      { $sort: { taskCount: -1 } },
    ]),
  ]);

  const todayAttendanceRate = todayAgg[0]
    ? parseFloat(((todayAgg[0].present / todayAgg[0].total) * 100).toFixed(1))
    : 0;

  return success(res, 200, 'Analytics fetched', {
    overview: {
      totalStudents,
      totalTeachers,
      todayAttendanceRate,
      todayMarked: todayAgg[0]?.total || 0,
      attendanceThisWeek: attendanceTrends.length
        ? parseFloat((attendanceTrends.reduce((s, d) => s + d.rate, 0) / attendanceTrends.length).toFixed(1))
        : 0,
    },
    attendanceTrends,
    topStudents,
    subjectUsage,
    classEngagement,
  });
});

/**
 * @desc    Get all teachers
 * @route   GET /api/admin/teachers
 * @access  Private (Admin)
 */
const getAllTeachers = asyncHandler(async (req, res) => {
  const teachers = await Teacher.find({ isActive: true })
    .populate('userId', 'email isActive')
    .sort({ name: 1 })
    .lean();

  return success(res, 200, 'Teachers fetched', teachers, { count: teachers.length });
});

/**
 * @desc    Add new teacher
 * @route   POST /api/admin/teachers/add
 * @access  Private (Admin)
 */
const addTeacher = asyncHandler(async (req, res) => {
  const {
    email, password, name, employeeId, contactNumber,
    subjects, qualification, experience,
    isClassTeacher, assignedClass, assignedSection,
    gender, dateOfBirth,
  } = req.body;

  if (!email || !password || !name || !employeeId || !contactNumber) {
    return error(res, 400, 'Please provide all required fields: email, password, name, employeeId, contactNumber');
  }

  const [existingUser, existingEmployee] = await Promise.all([
    User.findOne({ email }).lean(),
    Teacher.findOne({ employeeId }).lean(),
  ]);
  if (existingUser)     return error(res, 400, 'Email already exists');
  if (existingEmployee) return error(res, 400, 'Employee ID already exists');

  const user = await User.create({
    email,
    password,
    role:      'teacher',
    profileId: new mongoose.Types.ObjectId(),
  });

  const teacher = await Teacher.create({
    userId:          user._id,
    name,
    employeeId,
    contactNumber,
    subjects:        subjects       || [],
    qualification:   qualification  || undefined,
    experience:      experience     !== undefined ? experience : undefined,
    isClassTeacher:  isClassTeacher || false,
    assignedClass:   isClassTeacher ? assignedClass   : undefined,
    assignedSection: isClassTeacher ? assignedSection : undefined,
    gender:          gender         || undefined,
    dateOfBirth:     dateOfBirth    || undefined,
  });

  user.profileId = teacher._id;
  await user.save();

  return success(res, 201, 'Teacher added successfully', {
    teacherId:  teacher._id,
    userId:     user._id,
    name:       teacher.name,
    employeeId: teacher.employeeId,
    email:      user.email,
  });
});

/**
 * @desc    Update teacher
 * @route   PATCH /api/admin/teachers/:id
 * @access  Private (Admin)
 */
const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowed = [
    'name', 'subjects', 'qualification', 'experience',
    'isClassTeacher', 'assignedClass', 'assignedSection',
    'gender', 'dateOfBirth', 'contactNumber', 'isActive',
  ];

  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.assignedSection)      updates.assignedSection = updates.assignedSection.toUpperCase();
  if (updates.isClassTeacher === false) {
    updates.assignedClass   = undefined;
    updates.assignedSection = undefined;
  }

  const teacher = await Teacher.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
    .populate('userId', 'email isActive');

  if (!teacher) return error(res, 404, 'Teacher not found');

  return success(res, 200, 'Teacher updated successfully', teacher);
});

/**
 * @desc    Update student (admin — all fields)
 * @route   PATCH /api/admin/students/:id
 * @access  Private (Admin)
 */
const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowed = ['name', 'class', 'section', 'rollNumber', 'dateOfBirth', 'gender', 'parentContact', 'address', 'isActive'];

  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (updates.section) updates.section = updates.section.toUpperCase();

  const student = await Student.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
    .populate('userId', 'email isActive');

  if (!student) return error(res, 404, 'Student not found');

  return success(res, 200, 'Student updated successfully', student);
});

/**
 * @desc    Get student by ID
 * @route   GET /api/admin/students/:id
 * @access  Private (Admin)
 */
const getStudentById = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('userId', 'email isActive').lean();
  if (!student) return error(res, 404, 'Student not found');
  return success(res, 200, 'Student fetched', student);
});

/**
 * @desc    Create a new admin account
 * @route   POST /api/admin/create-admin
 * @access  Private (Admin)
 */
const createAdmin = asyncHandler(async (req, res) => {
  const { email, password, name, employeeId } = req.body;

  if (!email || !password || !name || !employeeId) {
    return error(res, 400, 'Please provide email, password, name, and employeeId');
  }

  const [existingUser, existingAdmin] = await Promise.all([
    User.findOne({ email }).lean(),
    Admin.findOne({ employeeId }).lean(),
  ]);
  if (existingUser)  return error(res, 400, 'Email already exists');
  if (existingAdmin) return error(res, 400, 'Employee ID already exists');

  const user = await User.create({
    email,
    password,
    role:      'admin',
    profileId: new mongoose.Types.ObjectId(),
  });

  const admin = await Admin.create({ userId: user._id, name, employeeId });

  user.profileId = admin._id;
  await user.save();

  return success(res, 201, 'Admin account created successfully', {
    adminId: admin._id,
    userId:  user._id,
    name:    admin.name,
    email:   user.email,
  });
});

/**
 * @desc    Get all classes with student counts
 * @route   GET /api/admin/classes
 * @access  Private (Admin)
 */
const getAllClasses = asyncHandler(async (req, res) => {
  const classes = await Student.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: { class: '$class', section: '$section' }, studentCount: { $sum: 1 } } },
    { $sort: { '_id.class': 1, '_id.section': 1 } },
    { $project: { _id: 0, class: '$_id.class', section: '$_id.section', studentCount: 1 } },
  ]);

  return success(res, 200, 'Classes fetched', classes, { count: classes.length });
});

/**
 * @desc    Get full attendance history with optional filters
 * @route   GET /api/admin/attendance/history
 * @access  Private (Admin)
 */
const getFullAttendanceHistory = asyncHandler(async (req, res) => {
  const { class: classFilter, section: sectionFilter, startDate, endDate } = req.query;

  const now   = new Date();
  const end   = endDate
    ? new Date(endDate)
    : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start = startDate
    ? new Date(startDate)
    : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 29));

  // Build match stage — use 'studentId' (the correct Attendance field name)
  const match = { date: { $gte: start, $lte: end } };
  if (classFilter && sectionFilter) {
    const studentIds = await Student.find(
      { class: classFilter, section: sectionFilter, isActive: true }
    ).distinct('_id');
    match.studentId = { $in: studentIds };
  }

  const records = await Attendance.aggregate([
    { $match: match },
    {
      $lookup: {
        from:         'students',
        localField:   'studentId',   // ← fixed: was 'student'
        foreignField: '_id',
        as:           'studentData',
      },
    },
    { $unwind: '$studentData' },
    {
      $group: {
        _id:     { date: '$date', class: '$studentData.class', section: '$studentData.section' },
        present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        total:   { $sum: 1 },
      },
    },
    { $sort: { '_id.date': -1, '_id.class': 1, '_id.section': 1 } },
    {
      $project: {
        _id:     0,
        date:    '$_id.date',
        class:   '$_id.class',
        section: '$_id.section',
        present: 1,
        total:   1,
        absent:  { $subtract: ['$total', '$present'] },
        rate:    { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] },
      },
    },
  ]);

  return success(res, 200, 'Attendance history fetched', records, { count: records.length });
});

/**
 * @desc    Upsert timetable schedule (update if exists, create if not)
 * @route   PUT /api/admin/timetable/update
 * @access  Private (Admin)
 */
const updateTimetable = asyncHandler(async (req, res) => {
  const { class: className, section, schedule } = req.body;

  if (!className || !section || !schedule) {
    return res.status(400).json({
      success: false,
      message: 'class, section and schedule are required',
    });
  }

  let timetable = await Timetable.findOne({
    class:    className,
    section:  section.toUpperCase(),
    isActive: true,
  });

  if (timetable) {
    timetable.schedule  = schedule;
    timetable.updatedAt = new Date();
    await timetable.save();
  } else {
    timetable = await Timetable.create({
      class:         className,
      section:       section.toUpperCase(),
      schedule,
      uploadedBy:    req.user.profileId,
      effectiveFrom: new Date(),
      isActive:      true,
    });
  }

  return res.status(200).json({
    success: true,
    message: timetable.createdAt?.getTime() === timetable.updatedAt?.getTime()
      ? 'Timetable created successfully'
      : 'Timetable updated successfully',
    data: timetable,
  });
});

/**
 * @desc    Get all active timetables
 * @route   GET /api/admin/timetable/all
 * @access  Private (Admin)
 */
const getAllTimetables = asyncHandler(async (req, res) => {
  const timetables = await Timetable.find({ isActive: true })
    .select('class section academicYear uploadedAt effectiveFrom')
    .sort({ class: 1, section: 1 })
    .lean();

  return success(res, 200, 'Timetables fetched', timetables, { count: timetables.length });
});

module.exports = {
  addStudent,
  getAllStudents,
  createTimetable,
  getTimetable,
  updateTimetable,
  getAllTimetables,
  getAnalytics,
  getAllTeachers,
  addTeacher,
  updateTeacher,
  updateStudent,
  getStudentById,
  createAdmin,
  getAllClasses,
  getFullAttendanceHistory,
};
