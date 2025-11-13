// utils/qrGenerator.js
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate unique QR code string for student
 * @param {object} studentData - Student information
 * @returns {string} Unique QR code identifier
 */
const generateQRCodeString = (studentData) => {
  const { studentId, rollNumber, name } = studentData;
  
  // Create a unique hash combining student info with timestamp
  const dataString = `${studentId}-${rollNumber}-${name}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  
  // Return first 16 characters for shorter QR code
  return hash.substring(0, 16).toUpperCase();
};

/**
 * Generate QR code image (base64)
 * @param {string} qrString - The string to encode in QR
 * @param {object} options - QR code options
 * @returns {Promise<string>} Base64 encoded QR code image
 */
const generateQRCodeImage = async (qrString, options = {}) => {
  try {
    const defaultOptions = {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H', // High error correction
      ...options
    };

    // Generate QR code as base64 data URL
    const qrDataURL = await QRCode.toDataURL(qrString, defaultOptions);
    return qrDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate student QR code with complete data
 * @param {object} student - Student document
 * @returns {Promise<object>} QR code string and image
 */
const generateStudentQRCode = async (student) => {
  try {
    // Generate unique QR string
    const qrString = generateQRCodeString({
      studentId: student._id.toString(),
      rollNumber: student.rollNumber,
      name: student.name
    });

    // Generate QR code image
    const qrImage = await generateQRCodeImage(qrString);

    return {
      qrString,
      qrImage,
      studentId: student._id,
      rollNumber: student.rollNumber
    };
  } catch (error) {
    console.error('Error generating student QR code:', error);
    throw error;
  }
};

/**
 * Validate QR code string
 * @param {string} qrString - QR string to validate
 * @returns {boolean} Is valid
 */
const validateQRCode = (qrString) => {
  // QR string should be 16 characters, alphanumeric uppercase
  const qrRegex = /^[A-Z0-9]{16}$/;
  return qrRegex.test(qrString);
};

/**
 * Parse scanned QR data
 * @param {string} scannedData - Data from QR scanner
 * @returns {object} Parsed QR information
 */
const parseQRData = (scannedData) => {
  try {
    // If it's a JSON string, parse it
    if (scannedData.startsWith('{')) {
      return JSON.parse(scannedData);
    }
    
    // Otherwise, treat it as QR code string
    return {
      qrCode: scannedData
    };
  } catch (error) {
    // If parsing fails, return as string
    return {
      qrCode: scannedData
    };
  }
};

module.exports = {
  generateQRCodeString,
  generateQRCodeImage,
  generateStudentQRCode,
  validateQRCode,
  parseQRData
};