const mongoose = require('mongoose');
const { httpError } = require('./errors');
function bodyObject(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(httpError(400, 'Se requiere un objeto JSON.'));
  }
  return next();
}
function text(value, max = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function objectId(value) {
  return typeof value === 'string' && mongoose.isObjectIdOrHexString(value);
}
function cleanEmail(value) {
  return text(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : '';
}
function emailMatch(email) {
  const literal = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: '^' + literal + '$', $options: 'i' };
}
module.exports = { bodyObject, text, objectId, cleanEmail, emailMatch };
