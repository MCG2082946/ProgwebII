const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Favorite = require('../models/Favorite');
const Book = require('../models/Book');
const User = require('../models/User');
const { errorHandler } = require('../middleware/errors');
const secret = randomBytes(48).toString('hex');
const previous = process.env.JWT_SECRET;
const a = '111111111111111111111111', b = '222222222222222222222222', id = 'abcdefabcdefabcdefabcdef';
let server, base, stored, books;
const query = (get) => ({ select() { return this; }, sort() { return this; }, lean: async () => structuredClone(get()),
  then(resolve, reject) { return Promise.resolve().then(get).then(resolve, reject); } });
async function request(method = 'GET', suffix = '', owner = a, body) {
  return fetch(base + suffix, { method, headers: { 'Content-Type': 'application/json',
    ...(owner ? { Authorization: 'Bearer ' + jwt.sign({ id: owner }, secret, { expiresIn: '1h' }) } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
before(async () => {
  process.env.JWT_SECRET = secret;
  const app = express(); app.use(express.json()); app.use('/favorites', require('../routes/favoriteRoutes')); app.use(errorHandler);
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port + '/favorites';
});
beforeEach(() => {
  stored = new Map(); books = new Map([[id, { _id: id, titulo: 'Favorito', precio: 10 }]]);
  mock.method(User, 'findById', (owner) => query(() => ({ _id: owner, rol: 'cliente' })));
  mock.method(Book, 'findById', (bookId) => query(() => books.get(bookId) || null));
  mock.method(Book, 'find', (filter) => query(() => filter._id.$in.map((bookId) => books.get(String(bookId))).filter(Boolean)));
  mock.method(Favorite, 'find', (filter) => query(() => {
    assert.deepEqual(Object.keys(filter), ['id_usuario']);
    return [...stored.values()].filter((item) => item.id_usuario === filter.id_usuario);
  }));
  mock.method(Favorite, 'findOne', (filter) => query(() => stored.get(filter.id_usuario + ':' + filter.id_libro) || null));
  mock.method(Favorite, 'updateOne', async (filter, update, options) => {
    assert.deepEqual(Object.keys(filter).sort(), ['id_libro', 'id_usuario']);
    assert.deepEqual(options, { upsert: true, runValidators: true });
    const key = filter.id_usuario + ':' + filter.id_libro;
    if (!stored.has(key)) stored.set(key, structuredClone(update.$setOnInsert));
  });
  mock.method(Favorite, 'deleteMany', async (filter) => { stored.delete(filter.id_usuario + ':' + filter.id_libro); });
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;
  await new Promise((resolve) => server.close(resolve));
});
test('save, reread, repeat/concurrent save and remove are idempotent', async () => {
  assert.deepEqual(await (await request()).json(), []);
  const responses = await Promise.all([request('PUT', '/' + id), request('PUT', '/' + id.toUpperCase())]);
  responses.forEach((r) => assert.equal(r.status, 204));
  assert.equal(stored.size, 1);
  assert.equal((await request('PUT', '/' + id)).status, 204);
  const list = await (await request()).json(); assert.equal(list.length, 1); assert.equal(list[0].libro.titulo, 'Favorito');
  for (let n = 0; n < 2; n++) assert.equal((await request('DELETE', '/' + id)).status, 204);
  assert.deepEqual(await (await request()).json(), []);
  assert.ok(Favorite.schema.indexes().some(([fields, options]) => fields.id_usuario && fields.id_libro && options.unique));
});
test('two accounts have independent lists and cannot delete each other favorites', async () => {
  await request('PUT', '/' + id);
  assert.deepEqual(await (await request('GET', '', b)).json(), []);
  await request('DELETE', '/' + id, b);
  assert.equal((await (await request()).json()).length, 1);
  await request('PUT', '/' + id, b); await request('DELETE', '/' + id);
  assert.equal((await (await request('GET', '', b)).json()).length, 1);
  assert.deepEqual(await (await request()).json(), []);
});
test('requires login, validates IDs, rejects supplied owner/data and checks book existence', async () => {
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await request(method, method === 'GET' ? '' : '/' + id, '')).status, 401);
  for (const method of ['PUT', 'DELETE']) {
    assert.equal((await request(method, '/invalid')).status, 400);
    assert.equal((await request(method, '/' + id, a, { id_usuario: b })).status, 400);
  }
  books.clear(); assert.equal((await request('PUT', '/' + id)).status, 404); assert.equal(stored.size, 0);
});
test('removed catalog books remain removable and database errors return no sample list', async () => {
  await request('PUT', '/' + id); books.clear();
  assert.deepEqual(await (await request()).json(), [{ id_libro: id, libro: null }]);
  await request('DELETE', '/' + id); assert.equal(stored.size, 0);
  Favorite.find.mock.mockImplementation(() => { throw new Error('private database error'); });
  const r = await request(); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { mensaje: 'Error interno del servidor.' });
});
test('unique index race returns success only when this account/book pair already exists', async () => {
  await request('PUT', '/' + id);
  Favorite.updateOne.mock.mockImplementation(async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  assert.equal((await request('PUT', '/' + id)).status, 204);
  assert.equal((await request('PUT', '/' + id, b)).status, 409);
});
