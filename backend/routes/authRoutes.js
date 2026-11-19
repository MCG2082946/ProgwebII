const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { bodyObject, objectId, cleanEmail, emailMatch } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

const { nameFields, validateName, requireName } = require('../middleware/profileName');
const { selection, publicUser, session } = require('../services/session');
function credentials(req, res, next) {
  const { email, password } = req.body;
  if (!cleanEmail(email) ||
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
  if (Object.keys(req.body).some((key) => ![...nameFields, 'email', 'password', 'rol', 'role'].includes(key))) {
    throw httpError(400, 'El registro contiene campos no permitidos.');
  }
  const name = requireName(req.body);
  if (password.length < 8) {
    throw httpError(400, 'Indica un nombre válido y una contraseña de al menos 8 caracteres.');
  }
  if (!process.env.JWT_SECRET?.trim()) throw new Error('Configuración JWT incompleta.');
  const normalizedEmail = cleanEmail(email);
  if (await User.exists({ email: emailMatch(normalizedEmail) })) throw httpError(409, 'El correo electrónico ya está registrado.');
  const user = await User.create({ ...name, email: normalizedEmail,
    contrasena_hash: await bcrypt.hash(password, 10), rol: 'cliente' });
  res.status(201).json({ mensaje: 'Usuario registrado exitosamente.', ...session(user) });
});
router.post('/login', bodyObject, credentials, async (req, res) => {
  if (Object.keys(req.body).some((key) => !['email', 'password'].includes(key))) {
    throw httpError(400, 'El inicio de sesión solo acepta correo y contraseña.');
  }
  const user = await User.findOne({ email: req.body.email }) ??
    await User.findOne({ email: emailMatch(req.body.email) });
  if (!user?.contrasena_hash || !await bcrypt.compare(req.body.password, user.contrasena_hash)) {
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
    const email = cleanEmail(req.body.email);
    if (!email) {
      throw Object.assign(httpError(400, 'Indica un correo electrónico válido de hasta 254 caracteres.'),
        { campos: { email: 'Indica un correo electrónico válido de hasta 254 caracteres.' } });
    }
    if (email !== cleanEmail(req.user.email) &&
        await User.exists({ _id: { $ne: req.user._id }, email: emailMatch(email) })) {
      throw httpError(409, 'El correo electrónico ya está registrado.');
    }
    changes.email = email === cleanEmail(req.user.email) ? req.user.email : email;
  }
  const user = await User.findOneAndUpdate({ _id: req.user._id }, { $set: changes },
    { new: true, runValidators: true }).select(selection);
  if (!user) throw httpError(401, 'La cuenta ya no existe.');
  res.json({ mensaje: 'Perfil actualizado.', usuario: publicUser(user) });
});

const accountForPromotion = (user) => ({
  id: user._id, nombre: user.nombre, email: user.email, rol: user.rol, nombreIncompleto: !validateName(user).valid,
});

router.post('/usuarios/buscar', authenticate, authorize('administrador'), bodyObject, async (req, res) => {
  const email = cleanEmail(req.body.email);
  if (!email || Object.keys(req.body).some((key) => key !== 'email')) {
    throw httpError(400, 'Ingresa un correo electrónico válido.');
  }
  const matches = await User.find({ email: emailMatch(email) }).select(selection).limit(2).lean();
  if (matches.length > 1) throw httpError(409, 'Hay más de una cuenta con ese correo. No se puede seleccionar una con seguridad.');
  res.set('Cache-Control', 'no-store').json({ usuario: matches.length ? accountForPromotion(matches[0]) : null });
});

router.patch('/usuarios/:id/vendedor', authenticate, authorize('administrador'), async (req, res) => {
  if (!objectId(req.params.id)) throw httpError(400, 'Identificador inválido.');
  if (req.body !== undefined && (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || Object.keys(req.body).length)) {
    throw httpError(400, 'Esta ruta solo habilita vendedores.');
  }
  const target = await User.findOne({ _id: req.params.id }, selection);
  if (!target) throw httpError(404, 'La cuenta no existe.');
  if (target.rol !== 'cliente') throw httpError(409, 'Solo se pueden habilitar cuentas con rol de cliente.');
  if (!validateName(target).valid) throw httpError(409, 'La cuenta debe completar su nombre en Mi perfil antes de habilitarse.');
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, rol: 'cliente', ...Object.fromEntries(nameFields.map((key) => [key, target[key]])) },
    { $set: { rol: 'vendedor' } }, { new: true, runValidators: true, projection: selection });
  if (!user) throw httpError(409, 'La cuenta cambió. Vuelve a buscarla antes de continuar.');
  res.set('Cache-Control', 'no-store').json({ mensaje: 'Cuenta habilitada como vendedor', usuario: accountForPromotion(user) });
});
module.exports = router;
