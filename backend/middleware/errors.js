function httpError(status, mensaje) {
  return Object.assign(new Error(mensaje), { status });
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return res.status(409).json({ mensaje: 'El registro ya existe.' });
  if (['ValidationError', 'CastError'].includes(error.name)) {
    return res.status(400).json({ mensaje: 'Los datos enviados no son válidos.' });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo debe ser JSON válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'La solicitud es demasiado grande.' });
  }
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  return res.status(status).json({ mensaje: status === 500 ? 'Error interno del servidor.' : error.message });
}
module.exports = { httpError, errorHandler };
