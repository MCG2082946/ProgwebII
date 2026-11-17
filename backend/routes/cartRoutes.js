const router = require('express').Router();
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const { authenticate } = require('../middleware/auth');
const { bodyObject, objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

router.use(authenticate);
const quantity = (value) => Number.isSafeInteger(value) && value > 0;
const cents = (value) => Math.round(value * 100);

// Releer catálogo: nunca confiar en precios/subtotales guardados o del cliente.
async function view(items, session) {
  let query = items.length ? Book.find({ _id: { $in: items.map((item) => item.id_libro) } })
    .select('_id titulo autor precio portada_url stock disponibilidad') : null;
  if (query && session) query = query.session(session);
  const books = query ? await query.lean() : [];
  const byId = new Map(books.map((book) => [String(book._id), book]));
  let totalCents = 0;
  const rows = items.map((item) => {
    const book = byId.get(String(item.id_libro));
    const available = Boolean(quantity(item.cantidad) && book && book.disponibilidad && book.stock >= item.cantidad &&
      Number.isFinite(book.precio) && book.precio >= 0);
    const subtotalCents = available ? cents(book.precio) * item.cantidad : 0;
    totalCents += subtotalCents;
    return { id_libro: String(item.id_libro), cantidad: item.cantidad,
      libro: book || null, disponible: available, subtotal: subtotalCents / 100,
      motivo: available ? null : !book ? 'Este libro fue retirado del catálogo.' :
        !book.disponibilidad || book.stock === 0 ? 'Este libro no está disponible.' :
          'No hay existencias suficientes. Reduce la cantidad o elimina el libro.' };
  });
  if (!Number.isSafeInteger(totalCents)) throw httpError(409, 'El importe del carrito excede el límite permitido.');
  return { items: rows, total: totalCents / 100 };
}

router.get('/', async (req, res) => {
  const cart = await Cart.findOne({ id_usuario: req.user._id }).lean();
  res.json(await view(cart?.items || []));
});

function validate(req, res, next) {
  const allowed = req.method === 'POST' ? ['id_libro', 'cantidad'] : ['cantidad'];
  if (Object.keys(req.body).some((key) => !allowed.includes(key)) || !quantity(req.body.cantidad)) {
    throw httpError(400, 'Indica una cantidad entera positiva y solo los campos permitidos.');
  }
  if (!objectId(req.method === 'POST' ? req.body.id_libro : req.params.id)) throw httpError(400, 'Libro inválido.');
  next();
}

async function mutate(req, res) {
  const owner = req.user._id;
  const rawId = req.method === 'POST' ? req.body.id_libro : req.params.id;
  if (!objectId(rawId)) throw httpError(400, 'Libro inválido.');
  const id = rawId.toLowerCase();
  // Comparación de versión evita perder cambios o duplicar filas entre pestañas.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const cart = await Cart.findOne({ id_usuario: owner }).lean();
    const items = (cart?.items || []).map((item) => ({ id_libro: item.id_libro, cantidad: item.cantidad }));
    const index = items.findIndex((item) => String(item.id_libro) === id);
    if (req.method === 'DELETE') {
      if (index >= 0) items.splice(index, 1);
    } else {
      if (req.method === 'PATCH' && index < 0) throw httpError(404, 'El libro no está en tu carrito.');
      const amount = req.method === 'POST' ? (index >= 0 ? items[index].cantidad : 0) + req.body.cantidad : req.body.cantidad;
      if (!quantity(amount)) throw httpError(400, 'Cantidad inválida.');
      const book = await Book.findById(id).select('_id stock disponibilidad');
      if (!book) throw httpError(404, 'El libro no existe.');
      if (!book.disponibilidad || amount > book.stock) throw httpError(409, 'El libro no está disponible en la cantidad solicitada.');
      if (index >= 0) items[index].cantidad = amount;
      else items.push({ id_libro: id, cantidad: amount });
    }
    const data = await view(items);
    const persisted = { items: data.items.map((item) => ({ id_libro: item.id_libro,
      cantidad: item.cantidad, subtotal: item.subtotal })), total: data.total };
    if (!cart) {
      if (req.method === 'DELETE') return res.json(data);
      try {
        // _id determinista protege también durante la creación inicial del índice único.
        await Cart.create({ _id: owner, id_usuario: owner, ...persisted });
        return res.json(data);
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
    }
    const updated = await Cart.findOneAndUpdate({ _id: cart._id, id_usuario: owner, __v: cart.__v ?? 0 },
      { $set: persisted, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (updated) return res.json(data);
  }
  throw httpError(409, 'El carrito cambió en otra sesión. Vuelve a consultarlo e intenta nuevamente.');
}

router.post('/items', bodyObject, validate, mutate);
router.patch('/items/:id', bodyObject, validate, mutate);
router.delete('/items/:id', (req, res, next) => {
  if (req.body && Object.keys(req.body).length) throw httpError(400, 'No se admiten campos al eliminar.');
  next();
}, mutate);
module.exports = router;
module.exports.view = view;
