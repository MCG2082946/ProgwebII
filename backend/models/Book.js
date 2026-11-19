const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  autor: { type: String, required: true },
  descripcion: { type: String },
  categoria: {
    // Mongoose también hidrata las referencias escalares de los libros anteriores.
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    validate: (ids) => ids.length > 0 && ids.every(Boolean) && new Set(ids.map(String)).size === ids.length,
  },
  tipoTapa: { type: String, enum: ['dura', 'blanda'], default: 'blanda' },
  precio: { type: Number, required: true, min: 0, validate: Number.isFinite },
  stock: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
  portada_url: { type: String },
  disponibilidad: { type: Boolean, default: true },
  id_vendedor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
