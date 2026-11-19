const router = require('express').Router();
const mongoose = require('mongoose');
const newFolio = require('../services/orderFolio');
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const Order = require('../models/Order');
const { view } = require('./cartRoutes');
const { authenticate } = require('../middleware/auth');
const { bodyObject } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');
const methods = {
  tarjeta: { metodo_pago: 'Tarjeta de crédito o débito', estado: 'pago_aprobado_demo' },
  spei: { metodo_pago: 'Transferencia SPEI', estado: 'pendiente_pago' },
  efectivo: { metodo_pago: 'Pago en efectivo', estado: 'pendiente_pago' },
};
router.use(authenticate);
router.get('/', async (req, res) => {
  res.json(await Order.find({ id_usuario: req.user._id }).sort({ createdAt: -1 }).lean());
});
router.post('/', bodyObject, async (req, res) => {
  if (Object.keys(req.body).some((key) => !['clave_compra', 'metodo_pago'].includes(key)) ||
      typeof req.body.clave_compra !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(req.body.clave_compra) ||
      typeof req.body.metodo_pago !== 'string' || !Object.hasOwn(methods, req.body.metodo_pago)) {
    throw httpError(400, 'Indica una clave y un método de demostración válidos, sin campos adicionales.');
  }
  const owner = req.user._id;
  const payment = methods[req.body.metodo_pago];
  const filter = { id_usuario: owner, clave_compra: req.body.clave_compra };
  // Confirmar los índices únicos antes de aceptar compras nuevas.
  await Order.init();
  const session = await mongoose.startSession();
  let order;
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await session.withTransaction(async () => {
          order = await Order.findOne(filter).session(session).lean();
          if (order) return;
          const cart = await Cart.findOne({ id_usuario: owner }).session(session).lean();
          if (!cart?.items.length) throw httpError(409, 'El carrito está vacío.');
          const data = await view(cart.items, { owner, session });
          const blocked = data.items.filter((item) => !item.disponible);
          if (blocked.length) {
            throw httpError(409, blocked.map((item) => item.propio ? item.motivo :
              `«${item.libro?.titulo ?? item.id_libro}»: ${item.motivo}`).join(' '));
          }
          const updated = await Cart.updateOne({ _id: cart._id, id_usuario: owner, __v: cart.__v ?? 0 },
            { $set: { items: [], total: 0 }, $inc: { __v: 1 } }, { session });
          if (updated.modifiedCount !== 1) throw httpError(409, 'El carrito cambió. Vuelve a consultarlo.');
          if (payment.estado === 'pago_aprobado_demo') {
            for (const item of data.items) {
              const result = await Book.updateOne(
                { _id: item.id_libro, disponibilidad: true, stock: { $gte: item.cantidad } },
                { $inc: { stock: -item.cantidad } }, { session },
              );
              if (result.modifiedCount !== 1) {
                throw httpError(409, `Cambió la disponibilidad de «${item.libro.titulo}». Ajusta la cantidad o elimínalo del carrito.`);
              }
            }
          }
          const folio = newFolio();
          const reference = ['spei', 'efectivo'].includes(req.body.metodo_pago)
            ? `DEMO-NO-PAGAR-${req.body.metodo_pago.toUpperCase()}-${folio}` : undefined;
          [order] = await Order.create([{ ...filter, ...payment, folio, referencia_demo: reference,
            total: data.total, detalles: data.items.map((item) => ({ id_libro: item.id_libro, id_vendedor: item.libro.id_vendedor ?? null,
              titulo: item.libro.titulo, precio_unitario: Math.round(item.libro.precio * 100) / 100, cantidad: item.cantidad })) }], { session });
        });
        break;
      } catch (error) {
        if (error.code !== 11000) throw error;
        order = await Order.findOne(filter).lean();
        if (order) break;
        // Una colisión del folio revierte también el vaciado del carrito.
        if (!error.keyPattern?.folio || attempt === 4) throw error;
      }
    }
  } finally { await session.endSession(); }
  res.json(order);
});
module.exports = router;
