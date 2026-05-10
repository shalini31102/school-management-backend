// utils/validators.js
const mongoose = require('mongoose');

/** Returns true when id is a valid 24-hex Mongoose ObjectId string. */
const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Basic RFC-5322-style email check. */
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Validates a 10-digit phone number (Indian standard). */
const validatePhone = (phone) => /^[0-9]{10}$/.test(phone);

/** Returns true when the value can be parsed as a valid JS Date. */
const validateDate = (date) => !Number.isNaN(Date.parse(date));

module.exports = { validateObjectId, validateEmail, validatePhone, validateDate };
