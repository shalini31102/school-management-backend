// controllers/teacherController.js
const { Student, Attendance, Teacher, Task, TaskSubmission } = require('../models');


/**
 * @desc    Mark attendance by scanning QR code
 * @route   POST /api/teacher/attendance/scan-qr
 * @access  Private (Teacher)
 */
const scanQRAttendance = async (req, res) => {
  try {
    const { qrCode, teacherId } = req.body;

    // Validate input
    if (!qrCode || !teacherId) {
      return res.status(400).json({
        success: false,
        message: 'QR code and teacher ID are required',
      });
    }

    // Find student by QR code
    const student = await Student.findOne({ qrCode });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR code. Student not found.',
      });
    }

    // Check if attendance already marked today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      studentId: student._id,
      date: today,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: `Attendance already marked for ${student.name} today.`,
        data: {
          student: {
            name: student.name,
            rollNumber: student.rollNumber,
            class: student.class,
            section: student.section,
          },
          attendance: existingAttendance,
        },
      });
    }

    // Mark attendance
    const attendance = await Attendance.create({
      studentId: student._id,
      class: student.class,
      section: student.section,
      date: today,
      status: 'present',
      markedBy: teacherId,
      scanMethod: 'qr',
    });

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        student: {
          name: student.name,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section,
        },
        attendance,
      },
    });
  } catch (error) {
    console.error('Scan QR attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message,
    });
  }
};

/**
 * @desc    Get attendance history for a class
 * @route   GET /api/teacher/attendance/history/:class/:section
 * @access  Private (Teacher)
 */
const getAttendanceHistory = async (req, res) => {
  try {
    const { class: className, section } = req.params;
    const { date } = req.query;

    let queryDate = new Date();
    if (date) {
      queryDate = new Date(date);
    }
    queryDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.find({
      class: className,
      section: section,
      date: queryDate,
    }).populate('studentId', 'name rollNumber');

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
      error: error.message,
    });
  }
};
/**
 * @desc    Get students in a class
 * @route   GET /api/teacher/students/:class/:section
 * @access  Private (Teacher)
 */
const getClassStudents = async (req, res) => {
  try {
    const { class: className, section } = req.params;

    // Get all students in the class
    const students = await Student.find({
      class: className,
      section: section,
      isActive: true,
    }).select('name rollNumber class section');

    // Check if attendance already marked today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAttendance = await Attendance.find({
      class: className,
      section: section,
      date: today,
    });

    // Add today's attendance status to each student
    const studentsWithAttendance = students.map(student => {
      const attendance = todayAttendance.find(a => 
        a.studentId.toString() === student._id.toString()
      );
      
      return {
        ...student.toObject(),
        todayAttendance: attendance ? attendance.status : null,
      };
    });

    res.status(200).json({
      success: true,
      data: studentsWithAttendance,
    });
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message,
    });
  }
};

/**
 * @desc    Mark attendance for multiple students
 * @route   POST /api/teacher/attendance/mark-multiple
 * @access  Private (Teacher)
 */
const markMultipleAttendance = async (req, res) => {
  try {
    const { teacherId, attendance } = req.body;

    if (!teacherId || !attendance || !Array.isArray(attendance)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data provided',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = [];
    const errors = [];

    // Mark attendance for each student
    for (const record of attendance) {
      try {
        const student = await Student.findById(record.studentId);
        
        if (!student) {
          errors.push(`Student ${record.studentId} not found`);
          continue;
        }

        // Check if already marked
        const existing = await Attendance.findOne({
          studentId: record.studentId,
          date: today,
        });

        if (existing) {
          // Update existing
          existing.status = record.status;
          existing.markedBy = teacherId;
          existing.scanMethod = 'manual';
          await existing.save();
          results.push(existing);
        } else {
          // Create new
          const newAttendance = await Attendance.create({
            studentId: record.studentId,
            class: student.class,
            section: student.section,
            date: today,
            status: record.status,
            markedBy: teacherId,
            scanMethod: 'manual',
          });
          results.push(newAttendance);
        }
      } catch (err) {
        errors.push(`Error marking attendance for ${record.studentId}: ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `Attendance marked for ${results.length} students`,
      data: {
        marked: results.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Mark multiple attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message,
    });
  }
};
/**
 * @desc    Assign task to class
 * @route   POST /api/teacher/tasks/assign
 * @access  Private (Teacher)
 */
const assignTask = async (req, res) => {
  try {
    const {
      title,
      description,
      subject,
      dueDate,
      totalMarks,
      difficulty,
      instructions,
      teacherId,
      targetClass,
      targetSection,
    } = req.body;

    // Validate required fields
    if (!title || !description || !subject || !dueDate || !teacherId || !targetClass || !targetSection) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Get all students in the target class
    const students = await Student.find({
      class: targetClass,
      section: targetSection,
      isActive: true,
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found in this class',
      });
    }

    const studentIds = students.map(s => s._id);

    // Create task
    const task = await Task.create({
      title,
      description,
      type: 'assignment',
      subject,
      assignedBy: teacherId,
      assignedTo: studentIds,
      targetClass,
      targetSection,
      dueDate: new Date(dueDate),
      totalMarks: totalMarks || 10,
      difficulty: difficulty || 'medium',
      instructions: instructions || undefined,
      isPersonalized: false,
      isForFreePeriod: false,
    });

    res.status(201).json({
      success: true,
      message: 'Task assigned successfully',
      data: {
        task,
        studentsCount: studentIds.length,
      },
    });
  } catch (error) {
    console.error('Assign task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning task',
      error: error.message,
    });
  }
};

/**
 * @desc    Get tasks assigned by teacher
 * @route   GET /api/teacher/tasks/my-tasks
 * @access  Private (Teacher)
 */
const getMyTasks = async (req, res) => {
  try {
    const teacherId = req.user.profileId;

    const tasks = await Task.find({
      assignedBy: teacherId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .limit(50);

    // Get submission counts for each task
    const tasksWithStats = await Promise.all(
      tasks.map(async (task) => {
        const totalAssigned = task.assignedTo.length;
        const submissions = await TaskSubmission.countDocuments({
          taskId: task._id,
        });

        return {
          ...task.toObject(),
          stats: {
            totalAssigned,
            submissions,
            pending: totalAssigned - submissions,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      count: tasksWithStats.length,
      data: tasksWithStats,
    });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message,
    });
  }
};

module.exports = {
  scanQRAttendance,
  getAttendanceHistory,
  getClassStudents,
  markMultipleAttendance,
  assignTask,
  getMyTasks,
};