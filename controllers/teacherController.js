// controllers/teacherController.js
const { Student, Attendance, Teacher } = require('../models');

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

module.exports = {
  scanQRAttendance,
  getAttendanceHistory,
};