const jwt = require('jsonwebtoken');
const { nameFields, validateName } = require('../middleware/profileName');

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
module.exports = { selection, publicUser, session };
