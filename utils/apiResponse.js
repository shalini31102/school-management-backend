// utils/apiResponse.js
/**
 * Standardised response helpers.
 *
 * success(res, statusCode, message, data, extra)
 *   extra – optional key/value pairs merged into the top-level body
 *           (e.g. { count: 10 })
 *
 * error(res, statusCode, message)
 */

const success = (res, statusCode = 200, message = 'Success', data, extra = {}) => {
  const body = { success: true, message, ...extra };
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
};

const error = (res, statusCode = 500, message = 'Server Error') =>
  res.status(statusCode).json({ success: false, message });

module.exports = { success, error };
