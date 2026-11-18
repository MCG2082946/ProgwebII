const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { randomBytes, randomUUID } = require('node:crypto');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Book = require('../models/Book');
const User = require('../models/User');
const { errorHandler } = require('../middleware/errors');
const secret = randomBytes(48).toString('hex');
const previous = process.env.JWT_SECRET;
const a = '111111111111111111111111', b = '222222222222222222222222', id = '333333333333333333333333';
let server, base, carts, orders, book, fail, tail;
const query = (get) => ({ select() { return this; }, session() { return this; }, sort() { return this; }, lean: async () => structuredClone(get()), then(resolve, reject) { return Promise.resolve().then(get).then(resolve, reject); } });
async function request(method = 'GET', body, owner = a, path = '') {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ id: owner }, secret, { expiresIn: '1h' }) }, ...(body ? { body: JSON.stringify({ metodo_pago: 'tarjeta', ...body }) } : {}) });
}
before(async () => {
  process.env.JWT_SECRET = secret;
  const app = express(); app.use(express.json()); app.use('/orders', require('../routes/orderRoutes')); app.use(errorHandler);
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port + '/orders';
});
beforeEach(() => {
  carts = new Map([a, b].map((owner) => [owner, { _id: owner, id_usuario: owner, __v: 0, items: [{ id_libro: id, cantidad: 2 }], total: 999 }]));
  orders = []; fail = false; tail = Promise.resolve();
  mock.method(Order, 'init', async () => {});
  book = { _id: id, titulo: 'Original', precio: 12.35, stock: 5, disponibilidad: true };
  mock.method(User, 'findById', (owner) => query(() => ({ _id: owner })));
  mock.method(Book, 'find', () => query(() => book ? [book] : []));
  mock.method(Cart, 'findOne', (filter) => query(() => carts.get(String(filter.id_usuario))));
  mock.method(Cart, 'updateOne', async (filter, update, options) => {
    assert.ok(options.session);
    const cart = carts.get(String(filter.id_usuario));
    if (cart.__v !== filter.__v) return { modifiedCount: 0 };
    Object.assign(cart, update.$set, { __v: cart.__v + 1 }); return { modifiedCount: 1 };
  });
  mock.method(Order, 'findOne', (filter) => query(() => orders.find((o) => o.id_usuario === filter.id_usuario && o.clave_compra === filter.clave_compra) || null));
  mock.method(Order, 'find', (filter) => query(() => orders.filter((o) => o.id_usuario === filter.id_usuario)));
  mock.method(Order, 'create', async ([data], options) => {
    assert.ok(options.session);
    if (fail) throw new Error('storage failure');
    const order = { ...structuredClone(data), _id: randomUUID(), createdAt: new Date().toISOString() };
    orders.push(order); return [order];
  });
  // Transaction double: serialized commits and rollback; no Mongo connection or dotenv.
  mock.method(mongoose, 'startSession', async () => ({
    async withTransaction(callback) {
      const previous = tail; let release; tail = new Promise((resolve) => { release = resolve; }); await previous;
      const oldCarts = structuredClone(carts), oldOrders = structuredClone(orders);
      try { await callback(); } catch (error) { carts = oldCarts; orders = oldOrders; throw error; } finally { release(); }
    }, async endSession() {},
  }));
});
afterEach(() => mock.restoreAll());
after(async () => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; await new Promise((resolve) => server.close(resolve)); });
test('purchase snapshots catalog prices and titles and clears only the authenticated cart', async () => {
  const response = await request('POST', { clave_compra: randomUUID() }); assert.equal(response.status, 200);
  const order = await response.json(); assert.equal(order.total, 24.7); assert.equal(order.estado, 'pago_aprobado_demo'); assert.equal(order.metodo_pago, 'Tarjeta de cr\u00e9dito o d\u00e9bito');
  assert.equal(order.detalles[0].titulo, 'Original'); assert.equal(order.detalles[0].cantidad, 2); assert.equal(order.detalles[0].precio_unitario, 12.35);
  assert.equal(carts.get(a).items.length, 0); assert.equal(carts.get(b).items.length, 1); assert.equal(book.stock, 5);
  book.titulo = 'Edited'; book.precio = 99;
  assert.equal((await (await request()).json())[0].detalles[0].titulo, 'Original');
});
test('availability and storage failures preserve the cart and create no orders', async () => {
  book.stock = 1; assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 409);
  book.stock = 5; fail = true; assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 500);
  assert.equal(carts.get(a).items[0].cantidad, 2); assert.equal(orders.length, 0);
});
test('parallel double click and retry return a single durable order, even after cart is refilled', async () => {
  const body = { clave_compra: randomUUID() };
  const results = await Promise.all([request('POST', body), request('POST', body)]);
  const data = await Promise.all(results.map((r) => r.json())); assert.equal(data[0]._id, data[1]._id); assert.equal(orders.length, 1);
  carts.get(a).items = [{ id_libro: id, cantidad: 1 }];
  assert.equal((await (await request('POST', body)).json())._id, data[0]._id); assert.equal(carts.get(a).items.length, 1);
});
test('history is isolated by authenticated account; owner and prices from client are rejected', async () => {
  const key = randomUUID(); await request('POST', { clave_compra: key });
  assert.deepEqual(await (await request('GET', undefined, b)).json(), []);
  await request('POST', { clave_compra: key }, b);
  for (const owner of [a, b]) { const history = await (await request('GET', undefined, owner)).json(); assert.equal(history.length, 1); assert.equal(history[0].id_usuario, owner); }
  assert.equal((await request('POST', { clave_compra: randomUUID(), total: 0, id_usuario: b })).status, 400);
  assert.equal((await fetch(base)).status, 401);
});
for (const [method, status, label] of [
  ['tarjeta', 'pago_aprobado_demo', 'Tarjeta de crédito o débito'],
  ['spei', 'pendiente_pago', 'Transferencia SPEI'],
  ['efectivo', 'pendiente_pago', 'Pago en efectivo'],
]) test(`${method}: server determines status, preserves folio and replay never duplicates`, async () => {
  const body = { clave_compra: randomUUID(), metodo_pago: method };
  const response = await request('POST', body); assert.equal(response.status, 200);
  const order = await response.json();
  assert.equal(order.estado, status); assert.equal(order.metodo_pago, label);
  assert.match(order.folio, /^LIB-[A-HJ-NP-Z2-9]{6}$/);
  if (status === 'pendiente_pago') assert.match(order.referencia_demo, /^DEMO-NO-PAGAR-/);
  else assert.equal(order.referencia_demo, undefined);
  const retry = await (await request('POST', { ...body, metodo_pago: 'tarjeta' })).json();
  assert.equal(retry.folio, order.folio); assert.equal(retry.estado, status); assert.equal(orders.length, 1);
  const history = await (await request()).json(); assert.equal(history[0].folio, order.folio);
  assert.equal(carts.get(a).items.length, 0); assert.equal(book.stock, 5);
});
test('rejects browser status and all card fields without writes', async () => {
  for (const field of ['estado', 'holder', 'number', 'expiry', 'code', 'titular', 'numero', 'vencimiento', 'cvv']) {
    assert.equal((await request('POST', { clave_compra: randomUUID(), [field]: 'not-accepted' })).status, 400);
  }
  for (const method of ['', null, {}, 'unknown', '__proto__', 'paypal', 'PayPal Sandbox']) {
    assert.equal((await request('POST', { clave_compra: randomUUID(), metodo_pago: method })).status, 400);
  }
  assert.equal(orders.length, 0); assert.equal(carts.get(a).items.length, 1);
});
test('removed PayPal routes return 404 and historical PayPal orders remain readable', async () => {
  const historical = { _id: 'sandbox-order', id_usuario: a, folio: 'LIB-8K4M2P',
    estado: 'paypal_sandbox_aprobado', metodo_pago: 'PayPal Sandbox', total: 20, detalles: [] };
  orders.push(historical);
  for (const path of ['/paypal', '/paypal/' + id + '/capture', '/paypal/' + id + '/cancel']) {
    assert.equal((await request('POST', { clave_compra: randomUUID() }, a, path)).status, 404);
  }
  assert.deepEqual(await (await request()).json(), [historical]);
  assert.deepEqual(await (await request('GET', undefined, b)).json(), []);
  assert.equal(carts.get(a).items.length, 1);
});
test('folio collision rolls back and retries; legacy orders remain accessible unchanged', async () => {
  let first = true;
  Order.create.mock.mockImplementation(async ([data], options) => {
    assert.ok(options.session);
    if (first) { first = false; throw Object.assign(new Error('collision'), { code: 11000, keyPattern: { folio: 1 } }); }
    const order = { ...data, _id: randomUUID(), createdAt: new Date().toISOString() }; orders.push(order); return [order];
  });
  assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 200);
  assert.equal(orders.length, 1); assert.equal(carts.get(a).__v, 1);
  orders.push({ _id: 'legacy-id', id_usuario: a, estado: 'simulado', total: 20, detalles: [] });
  const legacy = (await (await request()).json()).find((o) => o._id === 'legacy-id');
  assert.equal(legacy.folio, undefined); assert.equal(legacy.estado, 'simulado');
  assert.ok(Order.schema.indexes().some(([fields, options]) => fields.folio && options.unique));
});
