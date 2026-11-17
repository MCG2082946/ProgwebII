const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  id_libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true }
}, { timestamps: true });

favoriteSchema.index({ id_usuario: 1, id_libro: 1 }, { unique: true });
module.exports = mongoose.model('Favorite', favoriteSchema);
