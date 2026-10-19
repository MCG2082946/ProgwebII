const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  detalles: [{
    id_libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    cantidad: { type: Number, required: true },
    precio_unitario: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  estado: { 
    type: String, 
    enum: ['pendiente', 'pagado', 'enviado', 'entregado'], 
    default: 'pendiente' 
  },
  metodo_pago: { type: String, default: 'Tarjeta' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);