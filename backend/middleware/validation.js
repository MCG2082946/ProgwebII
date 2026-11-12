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
module.exports = { bodyObject, text, objectId };
