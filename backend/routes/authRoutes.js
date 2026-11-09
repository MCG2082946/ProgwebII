const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { bodyObject, text, objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

const publicUser = (user) => ({ id: user._id, nombre: user.nombre, email: user.email, rol: user.rol });
function session(user) {
  if (!process.env.JWT_SECRET?.trim()) throw new Error('Configuración JWT incompleta.');
  return {
    token: jwt.sign({ id: user._id.toString(), rol: user.rol }, process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '8h' }),
    usuario: publicUser(user)
  };
}
function credentials(req, res, next) {
  const { email, password } = req.body;
  if (!text(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || !password.length || Buffer.byteLength(password, 'utf8') > 72) {
    return next(httpError(400, 'Correo o contraseña inválidos. La contraseña admite hasta 72 bytes.'));
  }
  req.body.email = email.trim();
  return next();
}

router.post('/registro', bodyObject, credentials, async (req, res) => {
  const { nombre, email, password, rol, role } = req.body;
  if ((rol !== undefined && rol !== 'cliente') || (role !== undefined && role !== 'client')) {
    throw httpError(403, 'El registro público solo permite cuentas de cliente.');
  }
  if (!text(nombre) || password.length < 8) {
    throw httpError(400, 'Indica un nombre válido y una contraseña de al menos 8 caracteres.');
  }
  if (!process.env.JWT_SECRET?.trim()) throw new Error('Configuración JWT incompleta.');
  if (await User.exists({ email })) throw httpError(409, 'El correo electrónico ya está registrado.');
  const user = await User.create({ nombre: nombre.trim(), email,
    contrasena_hash: await bcrypt.hash(password, 10), rol: 'cliente' });
  res.status(201).json({ mensaje: 'Usuario registrado exitosamente.', ...session(user) });
});
router.post('/login', bodyObject, credentials, async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !await bcrypt.compare(req.body.password, user.contrasena_hash)) {
    throw httpError(401, 'Credenciales inválidas.');
  }
  res.json({ mensaje: 'Inicio de sesión exitoso.', ...session(user) });
});
router.get('/me', authenticate, (req, res) => res.json({ usuario: publicUser(req.user) }));

router.patch('/usuarios/:id/vendedor', authenticate, authorize('administrador'), async (req, res) => {
  if (!objectId(req.params.id)) throw httpError(400, 'Identificador inválido.');
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, rol: 'cliente' }, { $set: { rol: 'vendedor' } }, { new: true, runValidators: true });
  if (!user) throw httpError(409, 'No existe una cuenta de cliente habilitable con ese identificador.');
  res.json({ mensaje: 'Cuenta de vendedor habilitada.', usuario: publicUser(user) });
});
module.exports = router;
