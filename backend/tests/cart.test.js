const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const User = require('../models/User');
const { errorHandler } = require('../middleware/errors');
const key = randomBytes(48).toString('hex');
const previousSecret = process.env.JWT_SECRET;
const a = '111111111111111111111111';
const b = '222222222222222222222222';
const bookId = '333333333333333333333333';
let server, base, carts, books;
const clone = (data) => structuredClone(data);
const query = (get) => ({ lean: async () => clone(get()), select() { return this; }, then(resolve, reject) { return Promise.resolve().then(get).then(resolve, reject); } });
const token = (id = a) => jwt.sign({ id }, key, { expiresIn: '1h' });
async function request(method = 'GET', suffix = '', body, auth = token()) {
  return fetch(base + '/api/cart' + suffix, { method, headers: {
    'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}),
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
before(async () => {
  process.env.JWT_SECRET = key;
  const app = express(); app.use(express.json());
  app.use('/api/cart', require('../routes/cartRoutes')); app.use(errorHandler);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(() => {
  carts = new Map();
  books = new Map([[bookId, { _id: bookId, titulo: 'Libro real', autor: 'Autor', precio: 12.35, stock: 5, disponibilidad: true }]]);
  mock.method(User, 'findById', (id) => query(() => ({ _id: id, rol: 'cliente' })));
  mock.method(Book, 'findById', (id) => query(() => books.get(id) || null));
  mock.method(Book, 'find', (filter) => {
    assert.deepEqual(Object.keys(filter), ['_id']);
    return query(() => filter._id.$in.map((id) => books.get(String(id))).filter(Boolean));
  });
  mock.method(Cart, 'findOne', (filter) => {
    assert.deepEqual(Object.keys(filter), ['id_usuario']);
    return query(() => carts.get(String(filter.id_usuario)) || null);
  });
  mock.method(Cart, 'create', async (data) => {
    if (carts.has(String(data.id_usuario))) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const cart = { ...clone(data), _id: String(data.id_usuario), __v: 0 };
    carts.set(String(data.id_usuario), cart); return cart;
  });
  mock.method(Cart, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(Object.keys(filter).sort(), ['__v', '_id', 'id_usuario']);
    assert.deepEqual(options, { new: true, runValidators: true });
    const current = carts.get(String(filter.id_usuario));
    if (!current || current._id !== filter._id || current.__v !== filter.__v) return null;
    const next = { ...current, ...clone(update.$set), __v: current.__v + update.$inc.__v };
    carts.set(String(filter.id_usuario), next); return next;
  });
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  await new Promise((resolve) => server.close(resolve));
});

test('empty read, duplicate add, quantity update, delete and reread use server prices', async () => {
  assert.deepEqual(await (await request()).json(), { items: [], total: 0 });
  assert.equal(carts.size, 0);
  for (const amount of [1, 2]) {
    const response = await request('POST', '/items', { id_libro: bookId, cantidad: 1 });
    assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.items.length, 1);
    assert.equal(data.items[0].cantidad, amount); assert.equal(data.total, 12.35 * amount);
  }
  assert.equal(books.get(bookId).stock, 5);
  const updated = await request('PATCH', '/items/' + bookId, { cantidad: 3 });
  assert.equal((await updated.json()).total, 37.05);
  books.get(bookId).precio = 20;
  assert.equal((await (await request()).json()).total, 60);
  assert.equal((await request('DELETE', '/items/' + bookId)).status, 200);
  assert.deepEqual(await (await request()).json(), { items: [], total: 0 });
});

test('two accounts only read and change their own cart, never accept owner or price', async () => {
  await request('POST', '/items', { id_libro: bookId, cantidad: 2 });
  assert.deepEqual(await (await request('GET', '', undefined, token(b))).json(), { items: [], total: 0 });
  assert.equal((await request('PATCH', '/items/' + bookId, { cantidad: 1 }, token(b))).status, 404);
  await request('DELETE', '/items/' + bookId, undefined, token(b));
  assert.equal((await (await request()).json()).items[0].cantidad, 2);
  await request('POST', '/items', { id_libro: bookId, cantidad: 1 }, token(b));
  assert.equal((await (await request('GET', '', undefined, token(b))).json()).items[0].cantidad, 1);
  for (const field of ['id_usuario', 'userId', 'precio', 'subtotal', 'total', '$set']) {
    assert.equal((await request('POST', '/items', { id_libro: bookId, cantidad: 1, [field]: b })).status, 400);
    assert.equal((await request('PATCH', '/items/' + bookId, { cantidad: 1, [field]: b })).status, 400);
  }
});

test('requires authentication and validates quantities, stock, availability and book existence', async () => {
  for (const [method, path] of [['GET', ''], ['POST', '/items'], ['PATCH', '/items/' + bookId], ['DELETE', '/items/' + bookId]]) {
    assert.equal((await request(method, path, method === 'GET' ? undefined : { cantidad: 1 }, '')).status, 401);
  }
  for (const cantidad of [0, -1, 1.2, '2', null, {}, Number.MAX_SAFE_INTEGER + 1]) {
    for (const [method, path] of [['POST', '/items'], ['PATCH', '/items/' + bookId]]) {
      assert.equal((await request(method, path, { ...(method === 'POST' ? { id_libro: bookId } : {}), cantidad })).status, 400);
    }
  }
  for (const body of [null, [], {}, { id_libro: 'invalid', cantidad: 1 }]) {
    assert.equal((await request('POST', '/items', body)).status, 400);
  }
  assert.equal((await request('POST', '/items', { id_libro: b, cantidad: 1 })).status, 404);
  assert.equal((await request('POST', '/items', { id_libro: bookId, cantidad: 6 })).status, 409);
  books.get(bookId).disponibilidad = false;
  assert.equal((await request('POST', '/items', { id_libro: bookId, cantidad: 1 })).status, 409);
  assert.equal(carts.size, 0);
});

test('unavailable/deleted books remain removable, excluded from total; quantity can be reduced to stock', async () => {
  await request('POST', '/items', { id_libro: bookId, cantidad: 4 });
  books.get(bookId).stock = 2;
  let data = await (await request()).json();
  assert.equal(data.items[0].disponible, false); assert.equal(data.total, 0);
  assert.equal((await request('PATCH', '/items/' + bookId, { cantidad: 3 })).status, 409);
  assert.equal((await request('PATCH', '/items/' + bookId, { cantidad: 2 })).status, 200);
  books.delete(bookId);
  data = await (await request()).json();
  assert.equal(data.items[0].libro, null); assert.equal(data.items[0].cantidad, 2); assert.equal(data.total, 0);
  assert.equal((await request('DELETE', '/items/' + bookId)).status, 200);
});

test('concurrent additions do not duplicate rows or lose quantity, retrying unique/version conflicts', async () => {
  const responses = await Promise.all([request('POST', '/items', { id_libro: bookId, cantidad: 1 }),
    request('POST', '/items', { id_libro: bookId, cantidad: 1 })]);
  responses.forEach((response) => assert.equal(response.status, 200));
  const data = await (await request()).json();
  assert.equal(data.items.length, 1); assert.equal(data.items[0].cantidad, 2);
  await Promise.all([request('POST', '/items', { id_libro: bookId, cantidad: 1 }),
    request('POST', '/items', { id_libro: bookId, cantidad: 1 })]);
  assert.equal((await (await request()).json()).items[0].cantidad, 4);
});

test('ObjectId letter casing cannot create duplicate rows and exhausted version conflicts return 409', async () => {
  const id = 'abcdefabcdefabcdefabcdef';
  books.set(id, { ...books.get(bookId), _id: id });
  await request('POST', '/items', { id_libro: id, cantidad: 1 });
  await request('POST', '/items', { id_libro: id.toUpperCase(), cantidad: 1 });
  const data = await (await request()).json();
  assert.equal(data.items.length, 1); assert.equal(data.items[0].cantidad, 2);
  Cart.findOneAndUpdate.mock.mockImplementation(async () => null);
  assert.equal((await request('PATCH', '/items/' + id, { cantidad: 3 })).status, 409);
  assert.equal((await (await request()).json()).items[0].cantidad, 2);
});

test('database failures are private and cart model rejects invalid stored quantities', async () => {
  Cart.findOne.mock.mockImplementation(() => { throw new Error('private database details'); });
  const response = await request();
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { mensaje: 'Error interno del servidor.' });
  for (const cantidad of [0, -1, 1.5]) {
    await assert.rejects(new Cart({ id_usuario: a, items: [{ id_libro: bookId, cantidad }] }).validate());
  }
});
