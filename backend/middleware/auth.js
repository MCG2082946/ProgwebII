const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

async function authenticate(req, res, next) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ mensaje: 'Se requiere autenticación.' });
  if (!process.env.JWT_SECRET?.trim()) return next(new Error('Configuración JWT incompleta.'));
  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ mensaje: 'Token inválido o vencido.' });
  }
  if (!payload || typeof payload !== 'object' || !mongoose.isObjectIdOrHexString(payload.id) ||
      !Number.isFinite(payload.exp)) {
    return res.status(401).json({ mensaje: 'Token inválido.' });
  }
  try {
    // Consultar permisos actuales permite aplicar revocaciones de rol.
    const user = await User.findById(payload.id).select('_id nombre email rol');
    if (!user) return res.status(401).json({ mensaje: 'La cuenta ya no existe.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ mensaje: 'Se requiere autenticación.' });
    if (!roles.includes(req.user.rol)) return res.status(403).json({ mensaje: 'Permisos insuficientes.' });
    return next();
  };
}
module.exports = { authenticate, authorize };
