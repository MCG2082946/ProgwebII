const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    id_libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    cantidad: { type: Number, default: 1 },
    subtotal: { type: Number }
  }],
  total: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);