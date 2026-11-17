const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [{
    id_libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    cantidad: { type: Number, default: 1, required: true, min: 1, validate: Number.isSafeInteger },
    subtotal: { type: Number, min: 0 }
  }],
  total: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
