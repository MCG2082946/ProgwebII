const { randomUUID } = require('node:crypto');
const { appendFile, mkdir } = require('node:fs/promises');
const { dirname, join } = require('node:path');

const logFile = join(__dirname, '..', 'logs', 'backend.log');
const requestOperation = Symbol('requestOperation');
const events = new Set(['servidor.arranque', 'compra', 'vendedor.habilitacion', 'http.error']);
const phases = new Set(['inicio', 'fin', 'error']);
const results = new Set(['correcto', 'rechazado', 'fallido', 'interrumpido']);

function createFileLogger({ path = logFile, onError = () => console.error('No se pudo escribir la bitácora del backend.') } = {}) {
  let pending = Promise.resolve();
  let warned = false;

  function record(evento, fase, { resultado, codigoHttp, operacion } = {}) {
    if (!events.has(evento) || !phases.has(fase)) return pending;
    // Solo campos previstos. No serializar requests, usuarios ni errores.
    const entry = { fecha: new Date().toISOString(), evento, fase };
    if (results.has(resultado)) entry.resultado = resultado;
    if (Number.isInteger(codigoHttp) && codigoHttp >= 100 && codigoHttp <= 599) entry.codigoHttp = codigoHttp;
    if (typeof operacion === 'string' && /^[0-9a-f-]{36}$/i.test(operacion)) entry.operacion = operacion;
    pending = pending.then(async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await appendFile(path, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 });
      warned = false;
    }).catch(() => {
      if (!warned) onError();
      warned = true;
    });
    return pending;
  }

  return { record, flush: () => pending };
}

function trackOperation(evento) {
  return (req, res, next) => {
    const log = req.app.locals.eventLog;
    if (!log) return next();
    const operacion = randomUUID();
    req[requestOperation] = operacion;
    void log.record(evento, 'inicio', { operacion });
    res.once('finish', () => {
      const codigoHttp = res.statusCode;
      const resultado = codigoHttp >= 500 ? 'fallido' : codigoHttp >= 400 ? 'rechazado' : 'correcto';
      void log.record(evento, 'fin', { operacion, codigoHttp, resultado });
    });
    res.once('close', () => {
      if (!res.writableFinished) void log.record(evento, 'fin', { operacion, resultado: 'interrumpido' });
    });
    return next();
  };
}

function recordHttpError(req) {
  void req.app.locals.eventLog?.record('http.error', 'error', {
    codigoHttp: 500, resultado: 'fallido', operacion: req[requestOperation],
  });
}

module.exports = { createFileLogger, trackOperation, recordHttpError };
