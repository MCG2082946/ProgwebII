const router = require('express').Router();
const Book = require('../models/Book');
const Order = require('../models/Order');
const { authenticate, authorize } = require('../middleware/auth');
const { httpError } = require('../middleware/errors');

const lowStockThreshold = 5;
const confirmed = new Set(['pagado', 'enviado', 'entregado', 'simulado', 'pago_aprobado_demo', 'paypal_sandbox_aprobado']);
const pending = ['pendiente', 'pendiente_pago'];
const reportStatuses = [...confirmed, ...pending];

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function inventoryReports(books) {
  const byCategory = new Map();
  const lowStock = [];
  for (const book of books) {
    const categoryId = String(book.categoria?._id ?? '');
    const category = book.categoria?.nombre ?? 'Sin categoría';
    const units = book.stock ?? 0;
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, { id: categoryId, category, titles: 0, units: 0 });
    const totals = byCategory.get(categoryId);
    totals.titles += 1;
    totals.units += units;
    if (units <= lowStockThreshold) lowStock.push({ id: book._id, title: book.titulo, category, units });
  }
  return {
    lowStock: lowStock.sort((a, b) => a.units - b.units || a.title.localeCompare(b.title, 'es')),
    inventory: [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category, 'es')),
  };
}

async function orderReports(bookIds, from, to) {
  const ordersByStatus = [
    { status: 'Confirmados', orders: 0, units: 0 },
    { status: 'Pendientes', orders: 0, units: 0 },
  ];
  const ranking = new Map();
  if (!bookIds.length) return { orders: [], ranking: [] };

  const owned = new Set(bookIds.map(String));
  const orders = await Order.find({
    createdAt: { $gte: from, $lt: to },
    estado: { $in: reportStatuses },
    'detalles.id_libro': { $in: bookIds },
  }).select('estado detalles.id_libro detalles.titulo detalles.cantidad -_id')
    .sort({ createdAt: -1, _id: -1 }).lean();

  for (const order of orders) {
    const isConfirmed = confirmed.has(order.estado);
    const totals = ordersByStatus[isConfirmed ? 0 : 1];
    const items = order.detalles.filter((item) => owned.has(String(item.id_libro)));
    if (!items.length) continue;
    totals.orders += 1;
    for (const item of items) {
      totals.units += item.cantidad;
      if (!isConfirmed) continue;
      const id = String(item.id_libro);
      // La consulta ordena primero el pedido más reciente. Su título queda como etiqueta.
      if (!ranking.has(id)) ranking.set(id, { id, title: item.titulo, units: 0 });
      ranking.get(id).units += item.cantidad;
    }
  }
  return {
    orders: ordersByStatus.some((row) => row.orders) ? ordersByStatus : [],
    ranking: [...ranking.values()].sort((a, b) => b.units - a.units || a.title.localeCompare(b.title, 'es')),
  };
}

router.get('/', authenticate, authorize('vendedor'), async (req, res) => {
  const start = parseDay(req.query.desde);
  const end = parseDay(req.query.hasta);
  if (!start || !end || start > end) throw httpError(400, 'Indica un rango de fechas válido.');
  end.setUTCDate(end.getUTCDate() + 1);

  const books = await Book.find({ id_vendedor: req.user._id })
    .select('titulo stock categoria').populate('categoria', 'nombre').lean();
  res.json({
    lowStockThreshold,
    ...inventoryReports(books),
    ...await orderReports(books.map((book) => book._id), start, end),
  });
});

module.exports = router;
