const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  clave_compra: { type: String },
  id_usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  detalles: [{
    id_libro: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    titulo: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    precio_unitario: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  estado: { 
    type: String, 
    enum: ['pendiente', 'pagado', 'enviado', 'entregado', 'simulado'],
    default: 'pendiente' 
  },
  metodo_pago: { type: String, default: 'Tarjeta' }
}, { timestamps: true });

orderSchema.index({ id_usuario: 1, clave_compra: 1 }, { unique: true, partialFilterExpression: { clave_compra: { $type: 'string' } } });
module.exports = mongoose.model('Order', orderSchema);
