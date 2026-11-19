const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createFileLogger, trackOperation } = require('../services/eventLog');
const { errorHandler } = require('../middleware/errors');

async function testLog(t) {
  const directory = await mkdtemp(join(tmpdir(), 'progwebii-log-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'logs', 'backend.log');
  const log = createFileLogger({ path });
  return { path, log };
}

test('records structured events on disk in order and does not persist extra fields', async (t) => {
  const { path, log } = await testLog(t);
  void log.record('servidor.arranque', 'inicio', { password: 'not-for-the-log' });
  void log.record('unknown-user-event', 'inicio');
  void log.record('servidor.arranque', 'fin', { resultado: 'correcto', token: 'not-for-the-log' });
  await log.flush();
  const lines = (await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(lines.map(({ fecha, ...event }) => event), [
    { evento: 'servidor.arranque', fase: 'inicio' },
    { evento: 'servidor.arranque', fase: 'fin', resultado: 'correcto' },
  ]);
  assert.ok(lines.every(({ fecha }) => new Date(fecha).toISOString() === fecha));
});

test('records checkout and promotion outcomes as well as sanitized HTTP failures', async (t) => {
  const { path, log } = await testLog(t);
  const key = randomBytes(48).toString('hex');
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = key;
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
    mock.restoreAll();
  });
  const id = '1234567890abcdef12345678';
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: id, rol: 'administrador' }) }));
  const token = jwt.sign({ id }, key, { expiresIn: '1h' });
  const app = express();
  app.locals.eventLog = log;
  app.use(express.json());
  app.use('/api/orders', require('../routes/orderRoutes'));
  app.use('/api/auth', require('../routes/authRoutes'));
  app.post('/test/success', trackOperation('compra'), (req, res) => res.sendStatus(201));
  app.post('/test/error', trackOperation('compra'), () => { throw new Error('internal-only-message'); });
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const http = async (route, method = 'POST', body = {}) => {
    const response = await fetch(base + route, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    await response.text();
    return response.status;
  };
  assert.equal(await http('/api/orders', 'POST', { cvv: 'do-not-log' }), 400);
  assert.equal(await http('/api/auth/usuarios/not-a-valid-id/vendedor', 'PATCH'), 400);
  assert.equal(await http('/test/success'), 201);
  assert.equal(await http('/test/error?email=private@example.invalid'), 500);
  await log.flush();
  const raw = await readFile(path, 'utf8');
  const entries = raw.trim().split('\n').map(JSON.parse);
  assert.deepEqual(entries.map(({ evento, fase, resultado, codigoHttp }) =>
    [evento, fase, resultado, codigoHttp]), [
    ['compra', 'inicio', undefined, undefined],
    ['compra', 'fin', 'rechazado', 400],
    ['vendedor.habilitacion', 'inicio', undefined, undefined],
    ['vendedor.habilitacion', 'fin', 'rechazado', 400],
    ['compra', 'inicio', undefined, undefined],
    ['compra', 'fin', 'correcto', 201],
    ['compra', 'inicio', undefined, undefined],
    ['http.error', 'error', 'fallido', 500],
    ['compra', 'fin', 'fallido', 500],
  ]);
  for (const [start, end] of [[0, 1], [2, 3], [4, 5], [6, 7], [6, 8]]) {
    assert.ok(entries[start].operacion);
    assert.equal(entries[start].operacion, entries[end].operacion);
  }
  for (const value of [id, token, 'cvv', 'do-not-log', 'internal-only-message', 'private@example.invalid', 'not-a-valid-id']) {
    assert.ok(!raw.includes(value));
  }
});

test('a filesystem failure does not break the caller and logs a single warning while it persists', async (t) => {
  const { path } = await testLog(t);
  await writeFile(dirname(path), 'not a directory');
  let warnings = 0;
  const log = createFileLogger({ path, onError: () => { warnings += 1; } });
  await log.record('servidor.arranque', 'inicio');
  await log.record('servidor.arranque', 'fin', { resultado: 'fallido' });
  assert.equal(warnings, 1);
});
