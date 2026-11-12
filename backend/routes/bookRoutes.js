const router = require('express').Router();
const Book = require('../models/Book');
const Category = require('../models/Category');
const { authenticate, authorize } = require('../middleware/auth');
const { bodyObject, text, objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

router.get('/', async (req, res) => {
  res.json(await Book.find().populate('categoria', 'nombre descripcion'));
});
// Toda escritura, incluidas futuras rutas, requiere un rol autorizado.
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return authenticate(req, res, (error) => error ? next(error) : authorize('vendedor', 'administrador')(req, res, next));
});

async function bookData(body, partial = false) {
  const allowed = ['titulo', 'autor', 'categoria', 'precio', 'stock', 'portada_url', 'tipoTapa', 'disponibilidad'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw httpError(400, 'El libro contiene campos no permitidos.');
  const data = {};
  for (const key of ['titulo', 'autor']) {
    if (!partial || key in body) {
      if (!text(body[key])) throw httpError(400, 'Título y autor deben ser textos válidos.');
      data[key] = body[key].trim();
    }
  }
  if (!partial || 'categoria' in body) {
    if (!objectId(body.categoria)) throw httpError(400, 'Identificador de categoría inválido.');
    if (!await Category.exists({ _id: body.categoria })) throw httpError(404, 'La categoría no existe.');
    data.categoria = body.categoria;
  }
  if (!partial || 'precio' in body) {
    if (typeof body.precio !== 'number' || !Number.isFinite(body.precio) || body.precio < 0) {
      throw httpError(400, 'El precio debe ser un número no negativo.');
    }
    data.precio = body.precio;
  }
  if ('stock' in body) {
    if (!Number.isSafeInteger(body.stock) || body.stock < 0) throw httpError(400, 'El stock debe ser un entero no negativo.');
    data.stock = body.stock;
  }
  if ('portada_url' in body) {
    if (typeof body.portada_url !== 'string' || body.portada_url.length > 2048) throw httpError(400, 'URL de portada inválida.');
    if (body.portada_url) {
      let url;
      try { url = new URL(body.portada_url); } catch { throw httpError(400, 'URL de portada inválida.'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw httpError(400, 'La portada requiere HTTP o HTTPS.');
    }
    data.portada_url = body.portada_url;
  }
  if ('tipoTapa' in body) {
    if (!['dura', 'blanda'].includes(body.tipoTapa)) throw httpError(400, 'Tipo de tapa inválido.');
    data.tipoTapa = body.tipoTapa;
  }
  if ('disponibilidad' in body) {
    if (typeof body.disponibilidad !== 'boolean') throw httpError(400, 'Disponibilidad inválida.');
    data.disponibilidad = body.disponibilidad;
  }
  if (!Object.keys(data).length) throw httpError(400, 'No hay cambios para guardar.');
  return data;
}
function ownedFilter(req) {
  if (!objectId(req.params.id)) throw httpError(400, 'Identificador de libro inválido.');
  return req.user.rol === 'administrador' ? { _id: req.params.id } :
    { _id: req.params.id, id_vendedor: req.user._id };
}
router.post('/', bodyObject, async (req, res) => {
  const data = await bookData(req.body);
  const libro = await Book.create({ ...data, id_vendedor: req.user._id });
  res.status(201).json({ mensaje: 'Libro creado exitosamente.', libro });
});
router.patch('/:id', bodyObject, async (req, res) => {
  const filter = ownedFilter(req);
  const data = await bookData(req.body, true);
  const libro = await Book.findOneAndUpdate(filter, { $set: data }, { new: true, runValidators: true });
  if (!libro) throw httpError(404, 'Libro no encontrado o no accesible.');
  res.json({ mensaje: 'Libro actualizado.', libro });
});
router.put('/:id', bodyObject, async (req, res) => {
  const filter = ownedFilter(req);
  const data = await bookData(req.body);
  const libro = await Book.findOneAndUpdate(filter, { $set: data }, { new: true, runValidators: true });
  if (!libro) throw httpError(404, 'Libro no encontrado o no accesible.');
  res.json({ mensaje: 'Libro actualizado.', libro });
});
router.delete('/:id', async (req, res) => {
  const libro = await Book.findOneAndDelete(ownedFilter(req));
  if (!libro) throw httpError(404, 'Libro no encontrado o no accesible.');
  res.status(204).end();
});
module.exports = router;
