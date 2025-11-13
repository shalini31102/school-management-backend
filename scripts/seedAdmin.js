// scripts/seedAdmin.js
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { User, Admin } = require('../models');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🌱 Seeding admin user...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@school.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('📧 Email: admin@school.com');
      console.log('🔑 Password: Admin@123');
      process.exit(0);
    }

    // STEP 1: Create user first (without profileId)
    const adminUser = await User.create({
      email: 'admin@school.com',
      password: 'Admin@123', // This will be hashed automatically
      role: 'admin',
      profileId: new mongoose.Types.ObjectId() // Temporary ID
    });

    // STEP 2: Create admin profile with the userId
    const adminProfile = await Admin.create({
      userId: adminUser._id,  // Now we have the user ID
      employeeId: 'ADM001',
      name: 'System Administrator',
      contactNumber: '9999999999',
      permissions: [
        'manage_students',
        'manage_teachers',
        'manage_timetable',
        'approve_substitutes',
        'view_analytics',
        'manage_admins'
      ]
    });

    // STEP 3: Update user with correct profileId
    adminUser.profileId = adminProfile._id;
    await adminUser.save();

    console.log('✅ Admin user created successfully!');
    console.log('\n📧 Login Credentials:');
    console.log('   Email: admin@school.com');
    console.log('   Password: Admin@123');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();