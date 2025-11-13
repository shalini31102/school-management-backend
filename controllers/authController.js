// controllers/authController.js
const { User, Student, Teacher, Admin } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwtUtils');

/**
 * @desc    Register new user (Admin only can create users)
 * @route   POST /api/auth/register
 * @access  Private (Admin)
 */
const register = async (req, res) => {
  try {
    const { email, password, role, profileData } = req.body;

    // Validate required fields
    if (!email || !password || !role || !profileData) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, role, and profile data'
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    let profileId;

    // Create profile based on role
    switch (role) {
      case 'student':
        const student = await Student.create(profileData);
        profileId = student._id;
        break;

      case 'teacher':
        const teacher = await Teacher.create(profileData);
        profileId = teacher._id;
        break;

      case 'admin':
        const admin = await Admin.create(profileData);
        profileId = admin._id;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      role,
      profileId
    });

    // Update profile with userId
    const ProfileModel = role === 'student' ? Student : role === 'teacher' ? Teacher : Admin;
    await ProfileModel.findByIdAndUpdate(profileId, { userId: user._id });

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`,
      data: {
        userId: user._id,
        email: user.email,
        role: user.role,
        profileId
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get profile data based on role
    let profile;
    switch (user.role) {
      case 'student':
        profile = await Student.findById(user.profileId);
        break;
      case 'teacher':
        profile = await Teacher.findById(user.profileId);
        break;
      case 'admin':
        profile = await Admin.findById(user.profileId);
        break;
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: profile
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Get profile data
    let profile;
    switch (user.role) {
      case 'student':
        profile = await Student.findById(user.profileId);
        break;
      case 'teacher':
        profile = await Teacher.findById(user.profileId);
        break;
      case 'admin':
        profile = await Admin.findById(user.profileId);
        break;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: profile
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Clear refresh token
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: null
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out',
      error: error.message
    });
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const { verifyRefreshToken } = require('../utils/jwtUtils');
    const decoded = verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  changePassword,
  refreshToken
};