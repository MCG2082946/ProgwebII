const mongoose = require('mongoose');
const { nameFields, validateName, fullName } = require('../middleware/profileName');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 242 },
  nombres: { type: String, maxlength: 80 },
  primerApellido: { type: String, maxlength: 80 },
  segundoApellido: { type: String, maxlength: 80 },
  sinSegundoApellido: { type: Boolean, default: undefined },
  email: { type: String, required: true, unique: true, trim: true, maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  contrasena_hash: { type: String, required: true },
  rol: { 
    type: String, 
    enum: ['cliente', 'vendedor', 'administrador'], 
    default: 'cliente' 
  }
}, { timestamps: true });

userSchema.pre('validate', function () {
  // Las cuentas anteriores conservan nombre; nunca se intenta dividirlo.
  if (!nameFields.some((key) => this[key] !== undefined)) return;
  const result = validateName(this);
  for (const [key, message] of Object.entries(result.errors)) this.invalidate(key, message);
  if (result.valid) {
    Object.assign(this, result.data);
    this.nombre = fullName(result.data);
  }
});
module.exports = mongoose.model('User', userSchema);
