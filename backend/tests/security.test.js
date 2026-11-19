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
const completeName = { nombres: 'Ana', primerApellido: 'Perez', segundoApellido: 'Lopez', sinSegundoApellido: false };
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
  // Las pruebas de cambios de correo simulan ausencia de una cuenta homónima por defecto.
  User.exists.mock.mockImplementation(async () => false);
});
test('retired provider endpoints are unavailable', async () => {
  assert.equal((await request('/api/auth/social/providers')).status, 404);
  assert.equal((await request('/api/auth/social/google/start', 'POST', {})).status, 404);
  assert.equal((await request('/api/auth/social/facebook/callback')).status, 404);
});

test('authentication rejects extra fields and registration checks duplicate email case-insensitively', async () => {
  const data = { ...completeName, email: 'Test@Example.Invalid', password: 'test-password' };
  assert.equal((await request('/api/auth/registro', 'POST', { ...data, googleId: 'external' })).status, 400);
  assert.equal((await request('/api/auth/login', 'POST', { email: data.email, password: data.password, rol: 'vendedor' })).status, 400);
  User.exists.mock.mockImplementation(async ({ email }) => new RegExp(email.$regex, email.$options).test('test@example.invalid'));
  assert.equal((await request('/api/auth/registro', 'POST', data)).status, 409);
});

test('book validation rejects fractional cents, unsafe amounts and credentials in cover URLs', async () => {
  role = 'vendedor';
  Category.exists.mock.mockImplementation(async () => true);
  const data = { titulo: 'Libro', autor: 'Autor', categoria: categoryId, precio: 12.5, stock: 0 };
  for (const changes of [{ precio: 1.005 }, { precio: Number.MAX_SAFE_INTEGER }, { portada_url: 'https://user:pass@example.invalid/cover' }]) {
    assert.equal((await request('/api/books', 'POST', { ...data, ...changes }, token())).status, 400);
  }
  assert.equal(Book.create.mock.callCount(), 0);
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
  assert.deepEqual(Object.keys((await response.json()).usuario).sort(), ['email', 'id', 'nombre', 'nombreIncompleto', 'rol']);
});
test('registration rejects elevated roles and malformed bodies', async () => {
  const data = { ...completeName, email: 'test@example.invalid', password: 'test-password' };
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
  const body = { ...completeName, email: 'test@example.invalid', password: 'test-password' };
  const response = await request('/api/auth/registro', 'POST', body);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).usuario.rol, 'cliente');
  User.exists.mock.mockImplementation(async () => true);
  assert.equal((await request('/api/auth/registro', 'POST', body)).status, 409);
});
test('missing JWT configuration prevents registration before database writes', async () => {
  delete process.env.JWT_SECRET;
  const response = await request('/api/auth/registro', 'POST', {
    ...completeName, email: 'test@example.invalid', password: 'test-password'
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
  User.findOne.mock.mockImplementation(async () => ({ _id: userId, ...completeName, rol: 'cliente' }));
  User.findOneAndUpdate.mock.mockImplementation(async (filter, update) => {
    assert.equal(filter.rol, 'cliente');
    assert.deepEqual(update, { $set: { rol: 'vendedor' } });
    return { _id: userId, rol: 'vendedor' };
  });
  assert.equal((await request(path, 'PATCH', {}, token())).status, 200);
});

test('administrator looks up an exact email and enables the existing account once', async () => {
  const lookup = '/api/auth/usuarios/buscar';
  const targetId = '999999999999999999999999';
  const promote = '/api/auth/usuarios/' + targetId + '/vendedor';
  const target = { _id: targetId, nombre: 'Ana Perez Lopez', email: 'ana@example.invalid', rol: 'cliente',
    contrasena_hash: 'private', ...completeName };
  let matches = [target];
  for (const when of ['cliente', 'vendedor']) {
    role = when;
    assert.equal((await request(lookup, 'POST', { email: target.email }, token())).status, 403);
    assert.equal((await request(promote, 'PATCH', {}, token())).status, 403);
  }
  assert.equal((await request(lookup, 'POST', { email: target.email })).status, 401);
  assert.equal((await request(promote, 'PATCH', {})).status, 401);
  assert.equal(User.find.mock.callCount(), 0);
  role = 'administrador';
  User.find.mock.mockImplementation((filter) => ({
    select(fields) { assert.ok(!fields.includes('contrasena')); return this; },
    limit(count) { assert.equal(count, 2); return this; },
    lean: async () => matches.filter((account) => new RegExp(filter.email.$regex, filter.email.$options).test(account.email)),
  }));
  assert.equal((await request(lookup, 'POST', { email: 'ana' }, token())).status, 400);
  const found = await request(lookup, 'POST', { email: ' ANA@example.invalid ' }, token());
  const publicAccount = { id: targetId, nombre: target.nombre, email: target.email, rol: 'cliente', nombreIncompleto: false };
  assert.deepEqual(await found.json(), { usuario: publicAccount });
  assert.deepEqual(await (await request(lookup, 'POST', { email: 'na@example.invalid' }, token())).json(), { usuario: null });
  matches = [target, { ...target, email: 'ANA@example.invalid' }];
  assert.equal((await request(lookup, 'POST', { email: target.email }, token())).status, 409);

  User.findOne.mock.mockImplementation(async ({ _id, email }) => _id === targetId || email === target.email ? target : null);
  User.findOneAndUpdate.mock.mockImplementation(async (filter, update) => {
    assert.deepEqual(filter, { _id: targetId, rol: 'cliente', ...completeName });
    assert.deepEqual(update, { $set: { rol: 'vendedor' } });
    return Object.assign(target, update.$set);
  });
  assert.equal((await request('/api/auth/usuarios/invalido/vendedor', 'PATCH', {}, token())).status, 400);
  assert.equal((await request('/api/auth/usuarios/' + bookId + '/vendedor', 'PATCH', {}, token())).status, 404);
  assert.equal((await request(promote, 'PATCH', { rol: 'administrador' }, token())).status, 400);
  const success = await request(promote, 'PATCH', {}, token());
  assert.deepEqual(await success.json(), {
    mensaje: 'Cuenta habilitada como vendedor', usuario: { ...publicAccount, rol: 'vendedor' },
  });
  assert.equal((await request(promote, 'PATCH', {}, token())).status, 409);
  target.contrasena_hash = await bcrypt.hash('test-password', 4);
  const login = await request('/api/auth/login', 'POST', { email: target.email, password: 'test-password' });
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.usuario.id, targetId);
  assert.equal(session.usuario.rol, 'vendedor');
  User.findById.mock.mockImplementation((id) => ({ select: async () => id === targetId ? target : { _id: id, rol: 'administrador' } }));
  Category.exists.mock.mockImplementation(async () => true);
  Book.create.mock.mockImplementation(async (book) => {
    assert.equal(book.id_vendedor, targetId);
    return book;
  });
  assert.equal((await request('/api/books', 'POST', {
    titulo: 'Libro de prueba', autor: 'Ana', categoria: categoryId, stock: 1, precio: 10,
  }, session.token)).status, 201);
  target.rol = 'administrador';
  assert.equal((await request(promote, 'PATCH', {}, token())).status, 409);
  assert.equal(User.findOneAndUpdate.mock.callCount(), 1);
  assert.equal(User.create.mock.callCount(), 0);
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
test('book creation and editing normalize text while retaining the exact image URL', async () => {
  role = 'vendedor';
  Category.exists.mock.mockImplementation(async () => true);
  Book.create.mock.mockImplementation(async (data) => data);
  Book.findOneAndUpdate.mock.mockImplementation(async (_filter, update) => update.$set);
  const cover = 'https://Ejemplo.invalid/MiPortada/FoTo.JPG?Clave=Uno&firma=aBc';
  const body = { titulo: '  niñez y café ', autor: '  ángela muñoz ', descripcion: '  capítulo uno\n  capítulo dos ',
    categoria: categoryId, precio: 19.99, stock: 2, portada_url: ' ' + cover + ' ' };
  for (const [method, route, status] of [['POST', '/api/books', 201], ['PATCH', '/api/books/' + bookId, 200]]) {
    const res = await request(route, method, body, token());
    assert.equal(res.status, status);
    const { libro } = await res.json();
    assert.equal(libro.titulo, 'NIÑEZ Y CAFÉ');
    assert.equal(libro.autor, 'ÁNGELA MUÑOZ');
    assert.equal(libro.descripcion, 'CAPÍTULO UNO\n  CAPÍTULO DOS');
    assert.equal(libro.portada_url, cover);
  }
  const invalid = await request('/api/books', 'POST', { ...body, titulo: ' ', autor: '', stock: 1.2, portada_url: 'sin-url' }, token());
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys((await invalid.json()).campos).sort(), ['autor', 'portada_url', 'stock', 'titulo']);
});

test('category writes normalize accents and reject names already stored with different casing', async () => {
  role = 'administrador';
  Category.exists.mock.mockImplementation(async ({ nombre, _id }) => {
    assert.equal(_id?.$ne, nombre.$regex.includes('HISTORIA') ? categoryId : undefined);
    return new RegExp(nombre.$regex, nombre.$options).test('Niñez');
  });
  Category.create.mock.mockImplementation(async (data) => data);
  Category.findByIdAndUpdate.mock.mockImplementation(async (_id, update) => update.$set);
  const duplicate = await request('/api/categories', 'POST', { nombre: '  niñez ' }, token());
  assert.equal(duplicate.status, 409);
  assert.ok((await duplicate.json()).campos.nombre);
  const edit = await request('/api/categories/' + categoryId, 'PATCH', { nombre: ' Historia ', descripcion: ' méxico\nniñez ' }, token());
  assert.equal(edit.status, 200);
  assert.deepEqual((await edit.json()).categoria, { nombre: 'HISTORIA', descripcion: 'MÉXICO\nNIÑEZ' });
});
test('seller update and delete use an atomic owner filter', async () => {
  role = 'vendedor';
  const check = async (filter) => {
    assert.deepEqual(filter, { _id: bookId, id_vendedor: userId });
    return null;
  };
  Book.findOneAndUpdate.mock.mockImplementation(async (filter) => {
    assert.deepEqual(filter, { _id: bookId, id_vendedor: userId, categoria: { $type: 'objectId' } });
    return null;
  });
  Book.findOneAndDelete.mock.mockImplementation(check);
  assert.equal((await request('/api/books/' + bookId, 'PATCH', { precio: 20 }, token())).status, 404);
  assert.equal((await request('/api/books/' + bookId, 'DELETE', undefined, token())).status, 404);
});

test('books store category lists, retain legacy categories and reject missing references', async () => {
  role = 'vendedor';
  const second = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const body = { titulo: 'Libro', autor: 'Autor', precio: 20, stock: 0 };
  const legacy = Book.hydrate({ ...body, categoria: categoryId });
  assert.deepEqual(legacy.categoria.map(String), [categoryId]);
  Category.exists.mock.mockImplementation(async ({ _id }) => [categoryId, second].includes(_id));
  Book.create.mock.mockImplementation(async (data) => data);
  Book.findOneAndUpdate.mock.mockImplementation(async (filter, update) => {
    assert.equal(filter.id_vendedor, userId);
    return update.$set;
  });
  const categories = [categoryId, second];
  const result = await request('/api/books', 'POST', { ...body, categoria: categories }, token());
  assert.equal(result.status, 201);
  assert.deepEqual((await result.json()).libro.categoria, [categoryId, second]);
  const edit = await request('/api/books/' + bookId, 'PATCH', { categoria: categories }, token());
  assert.equal(edit.status, 200);
  assert.deepEqual((await edit.json()).libro.categoria, [categoryId, second]);
  assert.equal((await request('/api/books/' + bookId, 'PATCH', { categoria: [...categories, second.toUpperCase()] }, token())).status, 400);
  assert.equal((await request('/api/books/' + bookId, 'PATCH', { categoria: [] }, token())).status, 400);
  assert.equal((await request('/api/books', 'POST', { ...body, categoria: [second, bookId] }, token())).status, 404);
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
  Category.exists.mock.mockImplementation(async () => false);
  Category.create.mock.mockImplementation(async (data) => ({ _id: categoryId, ...data }));
  assert.equal((await request('/api/categories', 'POST', { nombre: 'Novela' }, token())).status, 201);
  role = 'administrador';
  Category.findByIdAndUpdate.mock.mockImplementation(async (id, update) => ({ _id: id, ...update.$set }));
  const response = await request('/api/categories/' + categoryId, 'PATCH', { nombre: 'Historia' }, token());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).categoria.nombre, 'HISTORIA');
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


const validNames = [
  { nombres: 'Ana', primerApellido: 'P\u00e9rez', segundoApellido: 'L\u00f3pez', sinSegundoApellido: false },
  { nombres: '  Mar\u00eda   Jos\u00e9 ', primerApellido: ' De  la Cruz ', segundoApellido: 'Mu\u00f1oz', sinSegundoApellido: false },
  { nombres: 'Jean-Luc', primerApellido: "O'Neill", segundoApellido: '', sinSegundoApellido: true },
  { nombres: 'Zo\u00eb', primerApellido: 'D\u2019Angelo', segundoApellido: 'Garc\u00eda-M\u00e1rquez', sinSegundoApellido: false },
  { nombres: '\u674e', primerApellido: '\u738b', segundoApellido: '', sinSegundoApellido: true }
];
for (const [index, name] of validNames.entries()) {
  test(`registration and profile normalize structured name ${index}`, async () => {
    const { requireName } = require('../middleware/profileName');
    const expected = requireName(name);
    User.exists.mock.mockImplementation(async () => false);
    User.create.mock.mockImplementation(async (data) => {
      for (const [key, value] of Object.entries(expected)) assert.equal(data[key], value);
      assert.equal(data.rol, 'cliente');
      return { _id: userId, ...data };
    });
    const registered = await request('/api/auth/registro', 'POST', { ...name, email: 'test@example.invalid', password: 'test-password' });
    assert.equal(registered.status, 201);
    assert.equal((await registered.json()).usuario.nombre, expected.nombre);
    role = index % 2 ? 'vendedor' : 'cliente';
    let stored = { _id: userId, nombre: 'Nombre anterior sin dividir', email: 'test@example.invalid', rol: role };
    User.findById.mock.mockImplementation(() => ({ select: async () => stored }));
    const legacy = await request('/api/auth/me', 'GET', undefined, token());
    assert.equal((await legacy.json()).usuario.nombreIncompleto, true);
    assert.equal((await request('/api/auth/me', 'PATCH', { email: 'other@example.invalid' }, token())).status, 400);
    User.findOneAndUpdate.mock.mockImplementation((filter, update, options) => {
      assert.deepEqual(filter, { _id: userId });
      assert.equal(options.runValidators, true);
      assert.deepEqual(update.$set, { ...expected, email: 'new@example.invalid' });
      stored = { ...stored, ...update.$set }; return { select: async () => stored };
    });
    const response = await request('/api/auth/me', 'PATCH', { ...name, email: 'new@example.invalid' }, token());
    assert.equal(response.status, 200);
    const saved = (await response.json()).usuario;
    assert.equal(saved.nombre, expected.nombre);
    assert.equal(saved.rol, role);
    assert.equal(saved.nombreIncompleto, false);
    assert.equal(saved.contrasena_hash, undefined);
    assert.deepEqual((await (await request('/api/auth/me', 'GET', undefined, token())).json()).usuario, saved);
    const hash = await bcrypt.hash('test-password', 4);
    User.findOne.mock.mockImplementation(async () => ({ ...stored, contrasena_hash: hash }));
    const login = await request('/api/auth/login', 'POST', { email: stored.email, password: 'test-password' });
    assert.deepEqual((await login.json()).usuario, saved);
  });
}

test('registration and profile reject incomplete, contradictory and malformed names before writes', async () => {
  const invalid = [
    { primerApellido: '' }, { segundoApellido: '', sinSegundoApellido: false },
    { segundoApellido: '', sinSegundoApellido: undefined }, { sinSegundoApellido: true },
    { nombres: '123' }, { nombres: 'Ana!' }, { nombres: ' ' }, { nombres: {} },
    { primerApellido: 'x'.repeat(81) }, { nombres: '-Ana' }, { nombres: "Ana''Maria" },
    { sinSegundoApellido: 'true' }, { segundoApellido: null }, { primerApellido: undefined }
  ];
  for (const change of invalid) {
    const data = { ...completeName, ...change };
    for (const [path, method] of [['/registro', 'POST'], ['/me', 'PATCH']]) {
      const response = await request('/api/auth' + path, method, {
        ...data, ...(method === 'POST' ? { email: 'test@example.invalid', password: 'test-password' } : {})
      }, token());
      assert.equal(response.status, 400, JSON.stringify(change));
      assert.ok(Object.keys((await response.json()).campos).length);
    }
  }
  assert.equal(User.create.mock.callCount(), 0);
  assert.equal(User.findOneAndUpdate.mock.callCount(), 0);
});

test('profile rejects protected fields and duplicate email, preserving role and identity', async () => {
  assert.equal((await request('/api/auth/me', 'PATCH', completeName)).status, 401);
  for (const field of ['nombre', 'rol', 'role', 'id', '_id', 'password', 'contrasena_hash', '$set']) {
    assert.equal((await request('/api/auth/me', 'PATCH', { ...completeName, [field]: 'other' }, token())).status, 400);
  }
  assert.equal(User.findOneAndUpdate.mock.callCount(), 0);
  User.findOneAndUpdate.mock.mockImplementation(() => ({ select: async () => {
    throw Object.assign(new Error('private index'), { code: 11000 });
  } }));
  const response = await request('/api/auth/me', 'PATCH', { ...completeName, email: 'taken@example.invalid' }, token());
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { mensaje: 'El registro ya existe.' });
});

test('legacy account cannot become seller until it completes its own name', async () => {
  role = 'administrador';
  User.findOne.mock.mockImplementation(async () => ({ _id: userId, nombre: 'Nombre antiguo', rol: 'cliente' }));
  const path = '/api/auth/usuarios/' + userId + '/vendedor';
  assert.equal((await request(path, 'PATCH', {}, token())).status, 409);
  assert.equal((await request(path, 'PATCH', completeName, token())).status, 400);
  assert.equal(User.findOneAndUpdate.mock.callCount(), 0);
  User.findOne.mock.mockImplementation(async () => ({ _id: userId, ...completeName, rol: 'cliente' }));
  User.findOneAndUpdate.mock.mockImplementation(async (filter, update) => {
    assert.deepEqual(filter, { _id: userId, rol: 'cliente', ...completeName });
    assert.deepEqual(update, { $set: { rol: 'vendedor' } });
    return { _id: userId, ...completeName, rol: 'vendedor' };
  });
  assert.equal((await request(path, 'PATCH', {}, token())).status, 200);
});

test('User model validates and generates full name while allowing untouched legacy records', async () => {
  const legacy = new User({ nombre: 'Nombre antiguo', email: 'old@example.invalid', contrasena_hash: 'hash' });
  await legacy.validate();
  assert.equal(legacy.nombre, 'Nombre antiguo');
  const modern = new User({ ...validNames[1], email: 'new@example.invalid', contrasena_hash: 'hash' });
  await modern.validate();
  assert.equal(modern.nombre, 'Mar\u00eda Jos\u00e9 De la Cruz Mu\u00f1oz');
  modern.sinSegundoApellido = true;
  await assert.rejects(modern.validate(), /segundoApellido/);
});
