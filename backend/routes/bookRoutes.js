const router = require('express').Router();
const Book = require('../models/Book');
const Category = require('../models/Category');
const { authenticate, authorize } = require('../middleware/auth');
const { bodyObject, text, objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

router.get('/', async (req, res) => {
  res.json(await Book.find().populate('categoria', 'nombre descripcion'));
});
router.get('/mine', authenticate, authorize('vendedor', 'administrador'), async (req, res) => {
  res.json(await Book.find({ id_vendedor: req.user._id }).populate('categoria', 'nombre descripcion'));
});
// Toda escritura, incluidas futuras rutas, requiere un rol autorizado.
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return authenticate(req, res, (error) => error ? next(error) : authorize('vendedor', 'administrador')(req, res, next));
});

async function bookData(body, partial = false) {
  const allowed = ['titulo', 'autor', 'descripcion', 'categoria', 'precio', 'stock', 'portada_url', 'tipoTapa', 'disponibilidad'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw httpError(400, 'El libro contiene campos no permitidos.');
  const data = {};
  const campos = {};
  for (const [key, message] of [['titulo', 'Indica un título válido.'], ['autor', 'Indica un autor válido.']]) {
    if (partial && !(key in body)) continue;
    if (typeof body[key] !== 'string' || !text(body[key].trim())) campos[key] = message;
    else data[key] = body[key].trim().toUpperCase();
  }
  if (!partial || 'categoria' in body) {
    const input = Array.isArray(body.categoria) ? body.categoria : [body.categoria];
    if (!input.length || !input.every(objectId)) campos.categoria = 'Selecciona al menos una categoría válida.';
    else {
      const ids = input.map((id) => id.toLowerCase());
      if (new Set(ids).size !== ids.length) campos.categoria = 'No repitas categorías.';
      else data.categoria = ids;
    }
  }
  if ('descripcion' in body) {
    if (typeof body.descripcion !== 'string' || body.descripcion.trim().length > 2000) campos.descripcion = 'La descripción admite hasta 2000 caracteres.';
    else data.descripcion = body.descripcion.trim().toUpperCase();
  }
  if (!partial || 'precio' in body) {
    const cents = Math.round(typeof body.precio === 'number' ? body.precio * 100 : NaN);
    if (!Number.isSafeInteger(cents) || body.precio < 0 || cents / 100 !== body.precio) {
      campos.precio = 'El precio debe ser no negativo, con hasta dos decimales y dentro del límite permitido.';
    } else data.precio = body.precio;
  }
  if (!partial || 'stock' in body) {
    if (!Number.isSafeInteger(body.stock) || body.stock < 0) campos.stock = 'El stock debe ser un entero no negativo.';
    else data.stock = body.stock;
  }
  if ('portada_url' in body) {
    if (typeof body.portada_url !== 'string' || body.portada_url.trim().length > 2048) campos.portada_url = 'URL de portada inválida.';
    else {
      const cover = body.portada_url.trim();
      if (cover) {
        try {
          const url = new URL(cover);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            campos.portada_url = 'La portada requiere una URL HTTP o HTTPS sin credenciales.';
          }
        } catch { campos.portada_url = 'URL de portada inválida.'; }
      }
      data.portada_url = cover;
    }
  }
  if ('tipoTapa' in body) {
    if (!['dura', 'blanda'].includes(body.tipoTapa)) campos.tipoTapa = 'Tipo de tapa inválido.';
    else data.tipoTapa = body.tipoTapa;
  }
  if ('disponibilidad' in body) {
    if (typeof body.disponibilidad !== 'boolean') campos.disponibilidad = 'Disponibilidad inválida.';
    else data.disponibilidad = body.disponibilidad;
  }
  if (Object.keys(campos).length) throw Object.assign(httpError(400, 'Revisa los datos del libro.'), { campos });
  if (data.categoria) {
    const found = await Promise.all(data.categoria.map((_id) => Category.exists({ _id })));
    if (found.some((category) => !category)) {
      const message = 'Una de las categorías no existe.';
      throw Object.assign(httpError(404, message), { campos: { categoria: message } });
    }
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
  if (!data.categoria) filter.categoria = { $type: 'objectId' };
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
