const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');
const { errorHandler } = require('../middleware/errors');

const seller = '111111111111111111111111';
const other = '222222222222222222222222';
const buyer = '333333333333333333333333';
const admin = '444444444444444444444444';
const roles = { [seller]: 'vendedor', [other]: 'vendedor', [buyer]: 'cliente', [admin]: 'administrador' };
const category = { _id: 'ficcion', nombre: 'Ficción' };
const books = [
  { _id: 'a', id_vendedor: seller, titulo: 'Título actual', categoria: category, stock: 5, disponibilidad: false },
  { _id: 'b', id_vendedor: seller, titulo: 'Brújula', categoria: category, stock: 10 },
  { _id: 'c', id_vendedor: seller, titulo: 'Mapa', categoria: { _id: 'viajes', nombre: 'Viajes' }, stock: 0 },
  { _id: 'x', id_vendedor: other, titulo: 'Libro de otro vendedor', categoria: category, stock: 1 },
];
const line = (id_libro, titulo, cantidad) => ({ id_libro, titulo, cantidad, precio_unitario: 100 });
const order = (createdAt, estado, ...detalles) => ({ createdAt: new Date(createdAt), estado, detalles, id_usuario: buyer, total: 9999 });
const orders = [
  order('2026-11-01T00:00:00Z', 'simulado', line('b', 'Brújula', 1)),
  order('2026-11-10T00:00:00Z', 'pagado', line('b', 'Brújula', 1)),
  order('2026-11-18T23:59:59.999Z', 'pago_aprobado_demo', line('a', 'Título guardado', 6), line('x', 'Título ajeno guardado', 50)),
  order('2026-11-12T00:00:00Z', 'pendiente_pago', line('c', 'Mapa', 100), line('x', 'Título ajeno pendiente', 80)),
  order('2026-11-13T00:00:00Z', 'pendiente', line('a', 'Título pendiente', 7)),
  order('2026-11-14T00:00:00Z', 'entregado', line('x', 'Solo de otro vendedor', 10)),
  order('2026-11-19T00:00:00Z', 'pagado', line('c', 'Fuera de periodo', 20)),
  order('2026-10-31T23:59:59.999Z', 'pagado', line('b', 'Antes del periodo', 20)),
];

let server, endpoint, previousSecret;
const secret = randomBytes(48).toString('hex');
const range = 'desde=2026-11-01&hasta=2026-11-18';
const request = (owner, query = range, claimedRole = 'vendedor') => fetch(endpoint + '?' + query, {
  headers: owner ? { Authorization: 'Bearer ' + jwt.sign({ id: owner, rol: claimedRole }, secret, { expiresIn: '1h' }) } : {},
});

before(async () => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const app = express();
  app.use('/api/reports', require('../routes/reportRoutes'));
  app.use(errorHandler);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  endpoint = 'http://127.0.0.1:' + server.address().port + '/api/reports';
});
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  mock.method(User, 'findById', (id) => ({ select: async () => roles[id] && { _id: id, rol: roles[id] } }));
  mock.method(Book, 'find', ({ id_vendedor }) => ({
    select() { return this; },
    populate: async () => books.filter((book) => book.id_vendedor === id_vendedor),
  }));
  mock.method(Order, 'find', (filter) => ({
    select(fields) {
      assert.equal(fields, 'estado detalles.id_libro detalles.id_vendedor detalles.titulo detalles.cantidad -_id');
      return this;
    },
    sort() { return this; },
    lean: async () => orders.filter((entry) => entry.createdAt >= filter.createdAt.$gte &&
      entry.createdAt < filter.createdAt.$lt && filter.estado.$in.includes(entry.estado) &&
      entry.detalles.some((item) => filter.detalles.$elemMatch.$or.some((condition) => condition.id_libro
        ? !Object.hasOwn(item, 'id_vendedor') && condition.id_libro.$in.includes(item.id_libro)
        : item.id_vendedor === condition.id_vendedor)))
      .sort((a, b) => b.createdAt - a.createdAt),
  }));
});
afterEach(() => mock.restoreAll());

test('reports require authentication and the current seller role', async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request(buyer)).status, 403);
  assert.equal((await request(admin)).status, 403);
  assert.equal(Book.find.mock.callCount(), 0);
  assert.equal(Order.find.mock.callCount(), 0);
  assert.equal((await request(seller, range, 'cliente')).status, 200);
});

test('stock includes zero and the threshold; inventory distinguishes titles from copies', async () => {
  const { lowStockThreshold, lowStock, inventory } = await (await request(seller)).json();
  assert.equal(lowStockThreshold, 5);
  assert.deepEqual(lowStock, [
    { id: 'c', title: 'Mapa', category: 'Viajes', units: 0 },
    { id: 'a', title: 'Título actual', category: 'Ficción', units: 5 },
  ]);
  assert.deepEqual(inventory, [
    { id: 'ficcion', category: 'Ficción', titles: 2, units: 15 },
    { id: 'viajes', category: 'Viajes', titles: 1, units: 0 },
  ]);
});

test('a shared book contributes to each category without repeating its low-stock row or order units', async () => {
  const original = books.find((book) => book._id === 'a');
  const second = { _id: 'viajes', nombre: 'Viajes' };
  Book.find.mock.mockImplementation(() => ({
    select() { return this; },
    populate: async () => [{ ...original, categoria: [original.categoria, second, second] }],
  }));
  const data = await (await request(seller)).json();
  assert.deepEqual(data.inventory, [
    { id: 'ficcion', category: 'Ficción', titles: 1, units: 5 },
    { id: 'viajes', category: 'Viajes', titles: 1, units: 5 },
  ]);
  assert.equal(data.lowStock.length, 1);
  assert.equal(data.orders[0].units, 6);
  assert.equal(data.ranking[0].units, 6);
});

test('period and ranking count only the authenticated seller’s lines in orders', async () => {
  const data = await (await request(seller)).json();
  assert.deepEqual(data.orders, [
    { status: 'Confirmados', orders: 3, units: 8 },
    { status: 'Pendientes', orders: 2, units: 107 },
  ]);
  assert.deepEqual(data.ranking, [
    { id: 'a', title: 'Título guardado', units: 6 },
    { id: 'b', title: 'Brújula', units: 2 },
  ]);
  assert.doesNotMatch(JSON.stringify(data), /ajeno|id_usuario|precio_unitario|9999/);
  const otherData = await (await request(other)).json();
  assert.deepEqual(otherData.ranking, [{ id: 'x', title: 'Título ajeno guardado', units: 60 }]);
  assert.deepEqual(otherData.orders, [
    { status: 'Confirmados', orders: 2, units: 60 },
    { status: 'Pendientes', orders: 1, units: 80 },
  ]);
});

test('a one-day period includes its entire UTC day; invalid dates fail before queries', async () => {
  for (const query of ['', 'desde=2026-02-30&hasta=2026-03-01', 'desde=2026-11-19&hasta=2026-11-18',
    range + '&desde=2026-11-01', range + '&id_vendedor=' + other]) {
    assert.equal((await request(seller, query)).status, 400);
  }
  assert.equal(Book.find.mock.callCount(), 0);
  const { orders, ranking } = await (await request(seller, 'desde=2026-11-18&hasta=2026-11-18')).json();
  assert.equal(orders[0].orders, 1);
  assert.equal(ranking[0].units, 6);
});

test('seller without current books does not attribute legacy lines with no surviving book', async () => {
  Book.find.mock.mockImplementation(() => ({
    select() { return this; },
    populate: async () => [],
  }));
  assert.deepEqual(await (await request(seller)).json(), {
    lowStockThreshold: 5, lowStock: [], inventory: [], orders: [], ranking: [],
  });
  assert.deepEqual(Order.find.mock.calls[0].arguments[0].detalles, { $elemMatch: { $or: [{ id_vendedor: seller }] } });
});
