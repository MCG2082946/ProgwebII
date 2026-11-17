const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { bodyObject, text, objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

const { nameFields, validateName, requireName } = require('../middleware/profileName');
const selection = '_id nombre email rol ' + nameFields.join(' ');
const publicUser = (user) => ({ id: user._id, nombre: user.nombre, email: user.email, rol: user.rol,
  ...Object.fromEntries(nameFields.filter((key) => user[key] !== undefined).map((key) => [key, user[key]])),
  nombreIncompleto: !validateName(user).valid });
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
  const { email, password, rol, role } = req.body;
  if ((rol !== undefined && rol !== 'cliente') || (role !== undefined && role !== 'client')) {
    throw httpError(403, 'El registro público solo permite cuentas de cliente.');
  }
  if ('nombre' in req.body) throw httpError(400, 'nombre es un campo de lectura.');
  const name = requireName(req.body);
  if (password.length < 8) {
    throw httpError(400, 'Indica un nombre válido y una contraseña de al menos 8 caracteres.');
  }
  if (!process.env.JWT_SECRET?.trim()) throw new Error('Configuración JWT incompleta.');
  if (await User.exists({ email })) throw httpError(409, 'El correo electrónico ya está registrado.');
  const user = await User.create({ ...name, email,
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

router.patch('/me', authenticate, bodyObject, async (req, res) => {
  const fields = Object.keys(req.body);
  if (!fields.length || fields.some((key) => ![...nameFields, 'email'].includes(key))) {
    throw httpError(400, 'Solo se permite editar los campos del nombre y email.');
  }
  const input = Object.fromEntries(nameFields.map((key) => [key,
    Object.hasOwn(req.body, key) ? req.body[key] : req.user[key]]));
  const changes = requireName(input);
  if ('email' in req.body) {
    if (!text(req.body.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())) {
      throw Object.assign(httpError(400, 'Indica un correo electrónico válido de hasta 254 caracteres.'),
        { campos: { email: 'Indica un correo electrónico válido de hasta 254 caracteres.' } });
    }
    changes.email = req.body.email.trim();
  }
  const user = await User.findOneAndUpdate({ _id: req.user._id }, { $set: changes },
    { new: true, runValidators: true }).select(selection);
  if (!user) throw httpError(401, 'La cuenta ya no existe.');
  res.json({ mensaje: 'Perfil actualizado.', usuario: publicUser(user) });
});

router.patch('/usuarios/:id/vendedor', authenticate, authorize('administrador'), async (req, res) => {
  if (!objectId(req.params.id)) throw httpError(400, 'Identificador inválido.');
  if (req.body && Object.keys(req.body).length) throw httpError(400, 'Esta ruta solo habilita vendedores.');
  const target = await User.findOne({ _id: req.params.id, rol: 'cliente' });
  if (!target) throw httpError(409, 'No existe una cuenta de cliente habilitable con ese identificador.');
  if (!validateName(target).valid) throw httpError(409, 'La cuenta debe completar su nombre en Mi perfil antes de habilitarse.');
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, rol: 'cliente', ...Object.fromEntries(nameFields.map((key) => [key, target[key]])) }, { $set: { rol: 'vendedor' } }, { new: true, runValidators: true });
  if (!user) throw httpError(409, 'No existe una cuenta de cliente habilitable con ese identificador.');
  res.json({ mensaje: 'Cuenta de vendedor habilitada.', usuario: publicUser(user) });
});
module.exports = router;
