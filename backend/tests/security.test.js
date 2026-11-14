const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Book = require('../models/Book');
const Category = require('../models/Category');
const { validateConfig } = require('../config');
const { errorHandler } = require('../middleware/errors');

// No dotenv, server.js, MongoDB connection or real credentials.
const key = randomBytes(48).toString('hex');
const savedSecret = process.env.JWT_SECRET;
const userId = '111111111111111111111111';
const bookId = '222222222222222222222222';
const categoryId = '333333333333333333333333';
let role;
let server;
let base;
const token = (overrides = {}, options = {}) => jwt.sign(
  { id: userId, rol: 'administrador', ...overrides }, key, { expiresIn: '1h', ...options });

before(async () => {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/books', require('../routes/bookRoutes'));
  app.use('/api/categories', require('../routes/categoryRoutes'));
  app.use(errorHandler);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  process.env.JWT_SECRET = key;
  role = 'cliente';
  mock.method(User, 'findById', () => ({ select: async () => ({
    _id: userId, rol: role, nombre: 'Cuenta de prueba', email: 'test@example.invalid'
  }) }));
  // Fail closed if a test touches any unexpected database operation.
  for (const model of [User, Book, Category]) {
    for (const method of ['find', 'findOne', 'exists', 'create', 'findOneAndUpdate',
      'findOneAndDelete', 'findByIdAndUpdate', 'findByIdAndDelete']) {
      mock.method(model, method, () => { throw new Error('Unexpected database operation'); });
    }
  }
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
  await new Promise((resolve) => server.close(resolve));
});
async function request(path, method = 'GET', body, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  return fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('configuration requires JWT_SECRET without exposing values', () => {
  assert.throws(() => validateConfig({ MONGO_URI: 'unused' }), /falta JWT_SECRET/);
  assert.throws(() => validateConfig({ JWT_SECRET: '  ', MONGO_URI: 'unused' }), /falta JWT_SECRET/);
  assert.throws(() => validateConfig({ JWT_SECRET: key }), /falta MONGO_URI/);
  assert.doesNotThrow(() => validateConfig({ JWT_SECRET: key, MONGO_URI: 'unused' }));
});
for (const resource of ['books', 'categories']) {
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    test(`${method} ${resource} rejects missing authentication`, async () => {
      const suffix = method === 'POST' ? '' : '/' + bookId;
      assert.equal((await request('/api/' + resource + suffix, method, {})).status, 401);
    });
  }
  test(`client cannot create ${resource}, despite admin role in token`, async () => {
    assert.equal((await request('/api/' + resource, 'POST', {}, token())).status, 403);
  });
}
test('invalid, expired, wrong algorithm and wrong signature tokens are rejected', async () => {
  for (const value of ['invalid', token({}, { expiresIn: -1 }),
    token({}, { algorithm: 'HS384' }), jwt.sign({ id: userId }, randomBytes(48), { expiresIn: '1h' })]) {
    assert.equal((await request('/api/auth/me', 'GET', undefined, value)).status, 401);
  }
});
test('deleted account cannot authenticate', async () => {
  User.findById.mock.mockImplementation(() => ({ select: async () => null }));
  assert.equal((await request('/api/auth/me', 'GET', undefined, token())).status, 401);
});
test('me returns canonical public identity', async () => {
  role = 'vendedor';
  const response = await request('/api/auth/me', 'GET', undefined, token());
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys((await response.json()).usuario).sort(), ['email', 'id', 'nombre', 'rol']);
});
test('registration rejects elevated roles and malformed bodies', async () => {
  const data = { nombre: 'Prueba', email: 'test@example.invalid', password: 'test-password' };
  for (const changes of [{ rol: 'vendedor' }, { rol: 'administrador' }, { role: 'seller' }]) {
    assert.equal((await request('/api/auth/registro', 'POST', { ...data, ...changes })).status, 403);
  }
  for (const body of [[], null, { ...data, email: { $ne: null } }, { ...data, password: 'short' }]) {
    assert.equal((await request('/api/auth/registro', 'POST', body)).status, 400);
  }
});
test('registration always creates client and duplicate emails return 409', async () => {
  User.exists.mock.mockImplementation(async () => false);
  User.create.mock.mockImplementation(async (data) => {
    assert.equal(data.rol, 'cliente');
    assert.notEqual(data.contrasena_hash, 'test-password');
    return { ...data, _id: userId };
  });
  const body = { nombre: 'Prueba', email: 'test@example.invalid', password: 'test-password' };
  const response = await request('/api/auth/registro', 'POST', body);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).usuario.rol, 'cliente');
  User.exists.mock.mockImplementation(async () => true);
  assert.equal((await request('/api/auth/registro', 'POST', body)).status, 409);
});
test('missing JWT configuration prevents registration before database writes', async () => {
  delete process.env.JWT_SECRET;
  const response = await request('/api/auth/registro', 'POST', {
    nombre: 'Prueba', email: 'test@example.invalid', password: 'test-password'
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { mensaje: 'Error interno del servidor.' });
  assert.equal(User.create.mock.callCount(), 0);
});
test('login validates types and returns 401 for unknown credentials', async () => {
  assert.equal((await request('/api/auth/login', 'POST', { email: {}, password: [] })).status, 400);
  User.findOne.mock.mockImplementation(async () => null);
  assert.equal((await request('/api/auth/login', 'POST', {
    email: 'test@example.invalid', password: 'test-password'
  })).status, 401);
});
test('only administrator can enable a client as seller', async () => {
  const path = '/api/auth/usuarios/' + userId + '/vendedor';
  role = 'vendedor';
  assert.equal((await request(path, 'PATCH', {}, token())).status, 403);
  role = 'administrador';
  User.findOneAndUpdate.mock.mockImplementation(async (filter, update) => {
    assert.equal(filter.rol, 'cliente');
    assert.deepEqual(update, { $set: { rol: 'vendedor' } });
    return { _id: userId, rol: 'vendedor' };
  });
  assert.equal((await request(path, 'PATCH', {}, token())).status, 200);
});
test('seller login returns canonical role and wrong password returns 401', async () => {
  const hash = await bcrypt.hash('test-password', 4);
  User.findOne.mock.mockImplementation(async () => ({
    _id: userId, nombre: 'Prueba', email: 'test@example.invalid', rol: 'vendedor', contrasena_hash: hash
  }));
  const body = { email: 'test@example.invalid', password: 'test-password' };
  const response = await request('/api/auth/login', 'POST', body);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.usuario.rol, 'vendedor');
  assert.equal(data.usuario.nombre, 'Prueba');
  assert.equal(data.usuario.contrasena_hash, undefined);
  assert.equal(jwt.verify(data.token, key, { algorithms: ['HS256'] }).id, userId);
  assert.equal((await request('/api/auth/login', 'POST', { ...body, password: 'incorrect' })).status, 401);
});
test('book creation assigns authenticated owner and validates stock/price', async () => {
  role = 'vendedor';
  Category.exists.mock.mockImplementation(async () => true);
  Book.create.mock.mockImplementation(async (data) => {
    assert.equal(data.id_vendedor, userId);
    return { _id: bookId, ...data };
  });
  const body = { titulo: 'Libro', autor: 'Autor', categoria: categoryId, precio: 0, stock: 0 };
  assert.equal((await request('/api/books', 'POST', body, token())).status, 201);
  for (const changes of [{ precio: -1 }, { stock: 1.5 }, { id_vendedor: bookId }, { categoria: 'bad' }]) {
    assert.equal((await request('/api/books', 'POST', { ...body, ...changes }, token())).status, 400);
  }
});
test('seller update and delete use an atomic owner filter', async () => {
  role = 'vendedor';
  const check = async (filter) => {
    assert.deepEqual(filter, { _id: bookId, id_vendedor: userId });
    return null;
  };
  Book.findOneAndUpdate.mock.mockImplementation(check);
  Book.findOneAndDelete.mock.mockImplementation(check);
  assert.equal((await request('/api/books/' + bookId, 'PATCH', { precio: 20 }, token())).status, 404);
  assert.equal((await request('/api/books/' + bookId, 'DELETE', undefined, token())).status, 404);
});

test('own inventory requires seller authentication and queries only its owner', async () => {
  assert.equal((await request('/api/books/mine')).status, 401);
  assert.equal((await request('/api/books/mine', 'GET', undefined, token())).status, 403);
  role = 'vendedor';
  Book.find.mock.mockImplementation((filter) => {
    assert.deepEqual(filter, { id_vendedor: userId });
    return { populate: async () => [{ _id: bookId, id_vendedor: userId }] };
  });
  const response = await request('/api/books/mine', 'GET', undefined, token());
  assert.equal(response.status, 200);
  assert.equal((await response.json())[0]._id, bookId);
});

test('category CRUD preserves creation and admin management permissions', async () => {
  role = 'vendedor';
  Category.create.mock.mockImplementation(async (data) => ({ _id: categoryId, ...data }));
  assert.equal((await request('/api/categories', 'POST', { nombre: 'Novela' }, token())).status, 201);
  role = 'administrador';
  Category.findByIdAndUpdate.mock.mockImplementation(async (id, update) => ({ _id: id, ...update.$set }));
  const response = await request('/api/categories/' + categoryId, 'PATCH', { nombre: 'Historia' }, token());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).categoria.nombre, 'Historia');
  Book.exists.mock.mockImplementation(async () => false);
  Category.findByIdAndDelete.mock.mockImplementation(async () => ({ _id: categoryId }));
  assert.equal((await request('/api/categories/' + categoryId, 'DELETE', undefined, token())).status, 204);
});
test('seller cannot edit/delete shared categories; used category returns 409', async () => {
  role = 'vendedor';
  for (const method of ['PATCH', 'PUT', 'DELETE']) {
    assert.equal((await request('/api/categories/' + categoryId, method, { nombre: 'Prueba' }, token())).status, 403);
  }
  role = 'administrador';
  Book.exists.mock.mockImplementation(async () => true);
  assert.equal((await request('/api/categories/' + categoryId, 'DELETE', undefined, token())).status, 409);
});
test('malformed JSON returns 400; internal database errors remain private', async () => {
  const malformed = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
  });
  assert.equal(malformed.status, 400);
  const response = await request('/api/auth/me', 'GET', undefined, token());
  assert.equal(response.status, 200);
  User.findById.mock.mockImplementation(() => { throw new Error('private internal detail'); });
  const failed = await request('/api/books', 'POST', {}, token());
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { mensaje: 'Error interno del servidor.' });
});
