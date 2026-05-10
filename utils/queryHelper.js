// utils/queryHelper.js

/**
 * Returns { page, limit, skip } from query-string params.
 * Defaults: page=1, limit=20. Max limit capped at 100.
 */
const getPaginationParams = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Returns a MongoDB date-range query object { $gte, $lte }.
 * If dates are omitted the default window is the last 30 days.
 *
 * @param {string|undefined} startDate  ISO date string "YYYY-MM-DD"
 * @param {string|undefined} endDate    ISO date string "YYYY-MM-DD"
 */
const getDateRange = (startDate, endDate) => {
  const now = new Date();
  const end   = endDate   ? new Date(endDate)   : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const start = startDate ? new Date(startDate) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  return { $gte: start, $lte: end };
};

/**
 * Builds a MongoDB $or query that case-insensitively matches
 * searchTerm against each of the provided field names.
 *
 * Returns {} when searchTerm is falsy (i.e. no filter applied).
 */
const buildSearchQuery = (fields, searchTerm) => {
  if (!searchTerm) return {};
  const regex = new RegExp(searchTerm, 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

module.exports = { getPaginationParams, getDateRange, buildSearchQuery };
