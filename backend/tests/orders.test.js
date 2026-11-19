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
let server, base, carts, orders, book, inventory, fail, tail;
const query = (get) => ({ select() { return this; }, session() { return this; }, sort() { return this; }, lean: async () => structuredClone(get()), then(resolve, reject) { return Promise.resolve().then(get).then(resolve, reject); } });
async function request(method = 'GET', body, owner = a, path = '') {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ id: owner }, secret, { expiresIn: '1h' }) }, ...(body ? { body: JSON.stringify({ metodo_pago: 'tarjeta', ...body }) } : {}) });
}
before(async () => {
  process.env.JWT_SECRET = secret;
  const app = express(); app.use(express.json());
  app.use('/orders', require('../routes/orderRoutes'));
  app.use('/cart', require('../routes/cartRoutes'));
  app.use('/books', require('../routes/bookRoutes'));
  app.use('/reports', require('../routes/reportRoutes'));
  app.use(errorHandler);
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port + '/orders';
});
beforeEach(() => {
  carts = new Map([a, b].map((owner) => [owner, { _id: owner, id_usuario: owner, __v: 0, items: [{ id_libro: id, cantidad: 2 }], total: 999 }]));
  orders = []; fail = false; tail = Promise.resolve();
  mock.method(Order, 'init', async () => {});
  book = { _id: id, titulo: 'Original', precio: 12.35, stock: 5, disponibilidad: true };
  inventory = new Map([[id, book]]);
  mock.method(User, 'findById', (owner) => query(() => ({ _id: owner })));
  mock.method(Book, 'find', (filter) => query(() => filter._id.$in.map((key) => inventory.get(key)).filter(Boolean)));
  mock.method(Book, 'updateOne', async (filter, update, options) => {
    assert.ok(options.session);
    assert.equal(filter.disponibilidad, true);
    assert.equal(update.$inc.stock, -filter.stock.$gte);
    const row = inventory.get(filter._id);
    if (!row?.disponibilidad || row.stock < filter.stock.$gte) return { modifiedCount: 0 };
    row.stock += update.$inc.stock;
    return { modifiedCount: 1 };
  });
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
      const oldStock = [...inventory.values()].map((row) => [row, row.stock]);
      try { await callback(); } catch (error) {
        carts = oldCarts; orders = oldOrders;
        for (const [row, stock] of oldStock) row.stock = stock;
        throw error;
      } finally { release(); }
    }, async endSession() {},
  }));
});
afterEach(() => mock.restoreAll());
after(async () => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; await new Promise((resolve) => server.close(resolve)); });
test('purchase snapshots catalog prices and titles and clears only the authenticated cart', async () => {
  const response = await request('POST', { clave_compra: randomUUID() }); assert.equal(response.status, 200);
  const order = await response.json(); assert.equal(order.total, 24.7); assert.equal(order.estado, 'pago_aprobado_demo'); assert.equal(order.metodo_pago, 'Tarjeta de cr\u00e9dito o d\u00e9bito');
  assert.equal(order.detalles[0].titulo, 'Original'); assert.equal(order.detalles[0].cantidad, 2); assert.equal(order.detalles[0].precio_unitario, 12.35);
  assert.equal(carts.get(a).items.length, 0); assert.equal(carts.get(b).items.length, 1); assert.equal(book.stock, 3);
  book.titulo = 'Edited'; book.precio = 99;
  assert.equal((await (await request()).json())[0].detalles[0].titulo, 'Original');
});

test('purchase and catalog deletion preserve the historical units of each seller in a mixed order', async () => {
  const second = '444444444444444444444444';
  const buyer = '666666666666666666666666';
  const otherBook = { ...book, _id: second, titulo: 'Otro libro', id_vendedor: b };
  book.id_vendedor = a;
  const catalog = inventory;
  catalog.set(second, otherBook);
  carts.set(buyer, { ...carts.get(a), _id: buyer, id_usuario: buyer,
    items: [...carts.get(a).items, { id_libro: second, cantidad: 3 }] });
  User.findById.mock.mockImplementation((owner) => query(() => ({ _id: owner, rol: 'vendedor' })));
  Book.find.mock.mockImplementation((filter) => ({
    ...query(() => filter._id.$in.map((key) => catalog.get(key)).filter(Boolean)),
    populate: async () => [...catalog.values()].filter((row) => row.id_vendedor === filter.id_vendedor),
  }));
  mock.method(Book, 'findOneAndDelete', async (filter) => {
    const row = catalog.get(filter._id);
    if (row?.id_vendedor !== filter.id_vendedor) return null;
    catalog.delete(filter._id);
    return row;
  });
  Order.find.mock.mockImplementation((filter) => query(() => orders.filter((order) =>
    new Date(order.createdAt) >= filter.createdAt.$gte && new Date(order.createdAt) < filter.createdAt.$lt &&
    filter.estado.$in.includes(order.estado) && order.detalles.some((item) =>
      filter.detalles.$elemMatch.$or.some((condition) => condition.id_libro
        ? !Object.hasOwn(item, 'id_vendedor') && condition.id_libro.$in.includes(item.id_libro)
        : item.id_vendedor === condition.id_vendedor)))));
  const api = (route, owner, method = 'GET') => fetch(new URL(route, base), {
    method, headers: { Authorization: 'Bearer ' + jwt.sign({ id: owner }, secret, { expiresIn: '1h' }) },
  });
  assert.equal((await request('POST', { clave_compra: randomUUID(), id_vendedor: b })).status, 400);
  const purchase = await request('POST', { clave_compra: randomUUID() }, buyer);
  assert.equal(purchase.status, 200);
  const { detalles, createdAt } = await purchase.json();
  assert.deepEqual(detalles.map((item) => [item.id_vendedor, item.cantidad]), [[a, 2], [b, 3]]);
  assert.equal(book.stock, 3);
  const day = createdAt.slice(0, 10);
  const reports = async (owner) => {
    const response = await api('/reports?desde=' + day + '&hasta=' + day, owner);
    assert.equal(response.status, 200);
    return response.json();
  };
  const before = await reports(a);
  assert.equal(before.lowStock[0].units, 3);
  assert.equal(before.inventory[0].units, 3);
  book.titulo = 'Editado';
  book.disponibilidad = false;
  assert.deepEqual((await reports(a)).ranking, [{ id, title: 'Original', units: 2 }]);
  assert.equal((await api('/books/' + id, a, 'DELETE')).status, 204);
  const after = await reports(a);
  assert.deepEqual(after.lowStock, []);
  assert.deepEqual(after.inventory, []);
  assert.deepEqual(after.orders[0], { status: 'Confirmados', orders: 1, units: 2 });
  assert.deepEqual(after.ranking, [{ id, title: 'Original', units: 2 }]);
  const otherReport = await reports(b);
  assert.deepEqual(otherReport.orders[0], { status: 'Confirmados', orders: 1, units: 3 });
  assert.deepEqual(otherReport.ranking, [{ id: second, title: 'Otro libro', units: 3 }]);
  catalog.set(id, { ...book, id_vendedor: b });
  assert.deepEqual((await reports(b)).ranking, otherReport.ranking);
});
test('a seller cannot check out a mixed cart containing their own book with any payment method', async () => {
  const second = '555555555555555555555555';
  const otherBook = { ...book, _id: second, id_vendedor: b };
  book.id_vendedor = a;
  inventory.set(second, otherBook);
  const cart = carts.get(a);
  cart.items.unshift({ id_libro: second, cantidad: 1 });
  const original = structuredClone(cart);
  User.findById.mock.mockImplementation((owner) => query(() => ({ _id: owner, rol: 'vendedor' })));
  for (const metodo_pago of ['tarjeta', 'spei', 'efectivo']) {
    const response = await request('POST', { clave_compra: randomUUID(), metodo_pago });
    assert.equal(response.status, 409);
    assert.match((await response.json()).mensaje, /Quita «Original» del carrito/);
  }
  assert.deepEqual(carts.get(a), original);
  assert.equal(Book.updateOne.mock.callCount(), 0);
  assert.equal(Order.create.mock.callCount(), 0);
  assert.equal(book.stock, 5);
  assert.equal(otherBook.stock, 5);
  assert.deepEqual(orders, []);
  carts.get(a).items.pop();
  assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 200);
  assert.equal(otherBook.stock, 4);
  assert.equal(book.stock, 5);
  assert.equal(orders[0].detalles[0].id_vendedor, b);
});
test('availability and storage failures preserve the cart and create no orders', async () => {
  book.stock = 1; assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 409);
  book.stock = 5; fail = true; assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 500);
  assert.equal(carts.get(a).items[0].cantidad, 2); assert.equal(orders.length, 0);
  assert.equal(book.stock, 5);
});
test('confirmed purchases reduce 5 units to 3 and then to 0 without changing manual availability', async () => {
  assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 200);
  assert.equal(book.stock, 3);
  carts.get(b).items[0].cantidad = 3;
  assert.equal((await request('POST', { clave_compra: randomUUID() }, b)).status, 200);
  assert.equal(book.stock, 0);
  assert.equal(book.disponibilidad, true);
  carts.get(a).items = [{ id_libro: id, cantidad: 1 }];
  assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 409);
  book.disponibilidad = false;
  book.stock = 4;
  assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 409);
  assert.equal(book.stock, 4);
  assert.equal(carts.get(a).items.length, 1);
  book.disponibilidad = true;
  assert.equal((await request('POST', { clave_compra: randomUUID() })).status, 200);
  assert.equal(book.stock, 3);
});

test('two customers competing for one copy can commit only one confirmed order', async () => {
  book.stock = 1;
  for (const cart of carts.values()) cart.items[0].cantidad = 1;
  const results = await Promise.all([a, b].map((owner) => request('POST', { clave_compra: randomUUID() }, owner)));
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
  assert.equal(book.stock, 0);
  assert.equal(orders.length, 1);
  const winner = orders[0].id_usuario;
  assert.equal(carts.get(winner).items.length, 0);
  assert.equal(carts.get(winner === a ? b : a).items[0].cantidad, 1);
});

test('when a conditional stock write fails after another succeeds, the transaction rolls back both stock and cart', async () => {
  const second = '555555555555555555555555';
  inventory.set(second, { ...book, _id: second });
  carts.get(a).items.push({ id_libro: second, cantidad: 1 });
  const update = async (filter, changes, options) => {
    assert.ok(options.session);
    if (filter._id === second) {
      assert.equal(book.stock, 3);
      return { modifiedCount: 0 };
    }
    book.stock += changes.$inc.stock;
    return { modifiedCount: 1 };
  };
  Book.updateOne.mock.mockImplementation(update);
  const response = await request('POST', { clave_compra: randomUUID() });
  assert.equal(response.status, 409);
  assert.equal(Book.updateOne.mock.callCount(), 2);
  assert.equal(book.stock, 5);
  assert.equal(inventory.get(second).stock, 5);
  assert.equal(orders.length, 0);
  assert.deepEqual(carts.get(a).items.map((item) => item.cantidad), [2, 1]);
});
test('all methods recheck changed catalog availability and preserve the existing cart', async () => {
  for (const [metodo_pago, change] of [
    ['tarjeta', { stock: 1 }],
    ['spei', { stock: 0 }],
    ['efectivo', { disponibilidad: false }],
  ]) {
    Object.assign(book, { stock: 5, disponibilidad: true }, change);
    const response = await request('POST', { clave_compra: randomUUID(), metodo_pago });
    assert.equal(response.status, 409);
    assert.match((await response.json()).mensaje, /«Original»/);
    assert.equal(carts.get(a).items[0].cantidad, 2);
  }
  assert.equal(orders.length, 0);
  assert.equal((await request('POST', { clave_compra: '-'.repeat(36) })).status, 400);
});
for (const metodo_pago of ['tarjeta', 'spei', 'efectivo']) {
  test(`${metodo_pago}: a seller setting stock to zero after adding rejects the order and preserves the cart`, async () => {
    const other = '444444444444444444444444';
    inventory.set(other, { ...book, _id: other, titulo: 'Otro libro' });
    book.id_vendedor = b;
    const cart = carts.get(a);
    cart.items = [];
    mock.method(Book, 'findById', (key) => query(() => inventory.get(key)));
    mock.method(Cart, 'findOneAndUpdate', async (filter, update) => {
      assert.equal(filter.id_usuario, a);
      Object.assign(cart, update.$set);
      cart.__v += update.$inc.__v;
      return cart;
    });
    mock.method(Book, 'findOneAndUpdate', async (filter, update) => {
      assert.equal(filter.id_vendedor, b);
      return Object.assign(book, update.$set);
    });
    User.findById.mock.mockImplementation((owner) => query(() => ({ _id: owner, rol: owner === b ? 'vendedor' : 'cliente' })));
    const api = (path, method, owner, body) => fetch(new URL(path, base), {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt.sign({ id: owner }, secret, { expiresIn: '1h' }) },
      body: JSON.stringify(body),
    });
    for (const id_libro of [other, id]) {
      const added = await api('/cart/items', 'POST', a, { id_libro, cantidad: 1 });
      assert.equal(added.status, 200);
      assert.equal((await added.json()).items.every((item) => item.disponible), true);
    }
    const saved = structuredClone(cart);
    const update = await api('/books/' + id, 'PATCH', b, { stock: 0 });
    assert.equal(update.status, 200);
    const response = await request('POST', { clave_compra: randomUUID(), metodo_pago });
    assert.equal(response.status, 409);
    assert.match((await response.json()).mensaje, /«Original»: Agotado/);
    assert.deepEqual(carts.get(a), saved);
    assert.equal(orders.length, 0);
    assert.equal(book.stock, 0);
    assert.equal(inventory.get(other).stock, 5);
    assert.equal(Book.updateOne.mock.callCount(), 0);
  });
}
test('parallel double click and retry return a single durable order, even after cart is refilled', async () => {
  const body = { clave_compra: randomUUID() };
  const results = await Promise.all([request('POST', body), request('POST', body)]);
  const data = await Promise.all(results.map((r) => r.json())); assert.equal(data[0]._id, data[1]._id); assert.equal(orders.length, 1);
  carts.get(a).items = [{ id_libro: id, cantidad: 1 }];
  assert.equal((await (await request('POST', body)).json())._id, data[0]._id); assert.equal(carts.get(a).items.length, 1);
  assert.equal(book.stock, 3);
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
  assert.equal(carts.get(a).items.length, 0); assert.equal(book.stock, method === 'tarjeta' ? 3 : 5);
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
  assert.equal(book.stock, 3);
  orders.push({ _id: 'legacy-id', id_usuario: a, estado: 'simulado', total: 20, detalles: [] });
  const legacy = (await (await request()).json()).find((o) => o._id === 'legacy-id');
  assert.equal(legacy.folio, undefined); assert.equal(legacy.estado, 'simulado');
  assert.ok(Order.schema.indexes().some(([fields, options]) => fields.folio && options.unique));
});
