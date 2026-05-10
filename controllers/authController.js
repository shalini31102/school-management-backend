// controllers/authController.js
const { User, Student, Teacher, Admin } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwtUtils');
const asyncHandler = require('../utils/asyncHandler');
const { success, error }  = require('../utils/apiResponse');

// ── helpers ───────────────────────────────────────────────────────────────────
const getProfile = async (role, profileId) => {
  if (role === 'student') return Student.findById(profileId).lean();
  if (role === 'teacher') return Teacher.findById(profileId).lean();
  if (role === 'admin')   return Admin.findById(profileId).lean();
  return null;
};

// ── Register ──────────────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { email, password, role, profileData } = req.body;

  if (!email || !password || !role || !profileData) {
    return error(res, 400, 'Please provide email, password, role, and profile data');
  }

  const userExists = await User.findOne({ email }).lean();
  if (userExists) return error(res, 400, 'User with this email already exists');

  const ProfileModel =
    role === 'student' ? Student :
    role === 'teacher' ? Teacher :
    role === 'admin'   ? Admin   : null;

  if (!ProfileModel) return error(res, 400, 'Invalid role specified');

  const profile = await ProfileModel.create(profileData);
  const user    = await User.create({ email, password, role, profileId: profile._id });
  await ProfileModel.findByIdAndUpdate(profile._id, { userId: user._id });

  return success(res, 201, `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully`, {
    userId: user._id,
    email:  user.email,
    role:   user.role,
    profileId: profile._id,
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return error(res, 400, 'Please provide email and password');

  const user = await User.findOne({ email }).select('+password');
  if (!user)           return error(res, 401, 'Invalid credentials');
  if (!user.isActive)  return error(res, 401, 'Your account has been deactivated. Please contact the administrator.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return error(res, 401, 'Invalid credentials');

  const profile      = await getProfile(user.role, user.profileId);
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  user.lastLogin    = new Date();
  await user.save();

  return success(res, 200, 'Login successful', {
    user: { id: user._id, email: user.email, role: user.role, profile },
    accessToken,
    refreshToken,
  });
});

// ── Get current user ──────────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user    = await User.findById(req.user.id).lean();
  const profile = await getProfile(user.role, user.profileId);

  return success(res, 200, 'User fetched', {
    user: { id: user._id, email: user.email, role: user.role, profile },
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
  return success(res, 200, 'Logged out successfully');
});

// ── Change password ───────────────────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return error(res, 400, 'Please provide current and new password');
  }

  const user = await User.findById(req.user.id).select('+password');
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) return error(res, 401, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();
  return success(res, 200, 'Password changed successfully');
});

// ── Refresh token ─────────────────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) return error(res, 400, 'Refresh token required');

  const { verifyRefreshToken } = require('../utils/jwtUtils');
  const decoded = verifyRefreshToken(token); // throws on invalid — caught by asyncHandler

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== token) return error(res, 401, 'Invalid refresh token');

  const newAccessToken = generateAccessToken(user._id);
  return success(res, 200, 'Token refreshed', { accessToken: newAccessToken });
});

module.exports = { register, login, getMe, logout, changePassword, refreshToken };
