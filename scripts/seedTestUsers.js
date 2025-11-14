// scripts/seedTestUsers.js
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { User, Teacher, Student } = require('../models');
const { generateStudentQRCode } = require('../utils/qrGenerator');
require('dotenv').config();

const seedTestUsers = async () => {
  try {
    await connectDB();
    
    console.log('🌱 Seeding test users...\n');

    // ==================== CREATE TEACHER ====================
    console.log('Creating teacher account...');
    
    // Check if teacher exists
    const existingTeacher = await User.findOne({ email: 'teacher@school.com' });
    
    if (existingTeacher) {
      console.log('⚠️  Teacher already exists');
    } else {
      // Create teacher user
      const teacherUser = await User.create({
        email: 'teacher@school.com',
        password: 'Teacher@123',
        role: 'teacher',
        profileId: new mongoose.Types.ObjectId()
      });

      // Create teacher profile
      const teacherProfile = await Teacher.create({
        userId: teacherUser._id,
        employeeId: 'TCH001',
        name: 'John Smith',
        subjects: ['Mathematics', 'Physics'],
        isClassTeacher: true,
        assignedClass: '10',
        assignedSection: 'A',
        qualification: 'M.Sc Mathematics',
        experience: 5,
        contactNumber: '9876543210',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'male'
      });

      // Update user with correct profileId
      teacherUser.profileId = teacherProfile._id;
      await teacherUser.save();

      console.log('✅ Teacher created successfully!');
      console.log('   Email: teacher@school.com');
      console.log('   Password: Teacher@123');
      console.log('   Employee ID: TCH001');
      console.log('   Class: 10-A (Class Teacher)\n');
    }

    // ==================== CREATE STUDENT ====================
    console.log('Creating student account...');
    
    // Check if student exists
    const existingStudent = await User.findOne({ email: 'student@school.com' });
    
    if (existingStudent) {
      console.log('⚠️  Student already exists');
    } else {
      // Create student user
      const studentUser = await User.create({
        email: 'student@school.com',
        password: 'Student@123',
        role: 'student',
        profileId: new mongoose.Types.ObjectId()
      });

      // Generate QR code for student
      const qrData = await generateStudentQRCode({
        _id: studentUser._id,
        rollNumber: 'STU001',
        name: 'Alice Johnson'
      });

      // Create student profile
      const studentProfile = await Student.create({
        userId: studentUser._id,
        rollNumber: 'STU001',
        name: 'Alice Johnson',
        class: '10',
        section: 'A',
        qrCode: qrData.qrString,
        dateOfBirth: new Date('2008-08-20'),
        gender: 'female',
        interests: ['coding', 'music', 'art'],
        careerGoals: ['software-engineer'],
        learningPace: 'medium',
        performanceLevel: 'strong',
        parentContact: {
          name: 'Robert Johnson',
          phone: '9988776655',
          email: 'parent@example.com'
        }
      });

      // Update user with correct profileId
      studentUser.profileId = studentProfile._id;
      await studentUser.save();

      console.log('✅ Student created successfully!');
      console.log('   Email: student@school.com');
      console.log('   Password: Student@123');
      console.log('   Roll Number: STU001');
      console.log('   Class: 10-A');
      console.log('   QR Code: ' + qrData.qrString + '\n');
    }

    console.log('🎉 Test users created successfully!\n');
    console.log('📧 Login Credentials Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👨‍💼 Admin:');
    console.log('   Email: admin@school.com');
    console.log('   Password: Admin@123\n');
    console.log('👨‍🏫 Teacher:');
    console.log('   Email: teacher@school.com');
    console.log('   Password: Teacher@123\n');
    console.log('👨‍🎓 Student:');
    console.log('   Email: student@school.com');
    console.log('   Password: Student@123\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
    process.exit(1);
  }
};

seedTestUsers();