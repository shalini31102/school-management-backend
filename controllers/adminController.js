// controllers/adminController.js
const { User, Student, Teacher } = require('../models');
const { generateStudentQRCode } = require('../utils/qrGenerator');
const mongoose = require('mongoose');

/**
 * @desc    Add new student
 * @route   POST /api/admin/students/add
 * @access  Private (Admin)
 */
const addStudent = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      rollNumber,
      class: className,
      section,
      dateOfBirth,
      gender,
      parentContact,
    } = req.body;

    // Validate required fields
    if (!email || !password || !name || !rollNumber || !className || !section) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    // Check if roll number already exists
    const existingRollNumber = await Student.findOne({ rollNumber });
    if (existingRollNumber) {
      return res.status(400).json({
        success: false,
        message: 'Roll number already exists',
      });
    }

    // Create user first
    const user = await User.create({
      email,
      password,
      role: 'student',
      profileId: new mongoose.Types.ObjectId(),
    });

    // Generate QR code
    const qrData = await generateStudentQRCode({
      _id: user._id,
      rollNumber,
      name,
    });

    // Create student profile
    const student = await Student.create({
      userId: user._id,
      rollNumber,
      name,
      class: className,
      section: section.toUpperCase(),
      qrCode: qrData.qrString,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || 'male',
      parentContact: parentContact || {},
      learningPace: 'medium',
      performanceLevel: 'medium',
    });

    // Update user with correct profileId
    user.profileId = student._id;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: {
        studentId: student._id,
        userId: user._id,
        name: student.name,
        rollNumber: student.rollNumber,
        email: user.email,
        qrCode: qrData.qrString,
        qrImage: qrData.qrImage,
      },
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding student',
      error: error.message,
    });
  }
};

/**
 * @desc    Get all students
 * @route   GET /api/admin/students
 * @access  Private (Admin)
 */
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({ isActive: true })
      .populate('userId', 'email isActive')
      .sort({ class: 1, section: 1, rollNumber: 1 });

    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message,
    });
  }
};

module.exports = {
  addStudent,
  getAllStudents,
};