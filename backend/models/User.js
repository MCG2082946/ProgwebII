const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contrasena_hash: { type: String, required: true },
  rol: { 
    type: String, 
    enum: ['cliente', 'vendedor', 'administrador'], 
    default: 'cliente' 
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);