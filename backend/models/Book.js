const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  autor: { type: String, required: true },
  // Aquí enlazamos la categoría usando ObjectId para relacionarla con Category.js
  categoria: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true 
  },
  tipoTapa: { type: String, enum: ['dura', 'blanda'], default: 'blanda' },
  precio: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  portada_url: { type: String },
  disponibilidad: { type: Boolean, default: true },
  id_vendedor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);