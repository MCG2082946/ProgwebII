const router = require('express').Router();
const Category = require('../models/Category');
const Book = require('../models/Book');
const { authenticate, authorize } = require('../middleware/auth');
const { bodyObject, text, objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

router.get('/', async (req, res) => res.json(await Category.find()));
router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return authenticate(req, res, (error) => error ? next(error) : authorize('vendedor', 'administrador')(req, res, next));
});
function categoryData(body, partial = false) {
  if (Object.keys(body).some((key) => !['nombre', 'descripcion'].includes(key))) {
    throw httpError(400, 'La categoría contiene campos no permitidos.');
  }
  const data = {};
  if (!partial || 'nombre' in body) {
    if (typeof body.nombre !== 'string' || !text(body.nombre.trim())) {
      const message = 'El nombre de categoría es obligatorio y debe ser válido.';
      throw Object.assign(httpError(400, message), { campos: { nombre: message } });
    }
    data.nombre = body.nombre.trim().toUpperCase();
  }
  if ('descripcion' in body) {
    if (typeof body.descripcion !== 'string' || body.descripcion.trim().length > 2000) {
      const message = 'Descripción inválida.';
      throw Object.assign(httpError(400, message), { campos: { descripcion: message } });
    }
    data.descripcion = body.descripcion.trim().toUpperCase();
  }
  if (!Object.keys(data).length) throw httpError(400, 'No hay cambios para guardar.');
  return data;
}
async function saveCategory(data, persist, id) {
  const duplicate = () => Object.assign(httpError(409, 'La categoría ya existe.'), { campos: { nombre: 'La categoría ya existe.' } });
  if (data.nombre) {
    const literal = data.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (await Category.exists({ nombre: { $regex: '^' + literal + '$', $options: 'i' }, ...(id ? { _id: { $ne: id } } : {}) })) {
      throw duplicate();
    }
  }
  try { return await persist(data); }
  catch (error) {
    if (error.code === 11000) throw duplicate();
    throw error;
  }
}
function categoryId(req) {
  if (!objectId(req.params.id)) throw httpError(400, 'Identificador de categoría inválido.');
  return req.params.id;
}
router.post('/', bodyObject, async (req, res) => {
  const categoria = await saveCategory(categoryData(req.body), (data) => Category.create(data));
  res.status(201).json({ mensaje: 'Categoría creada exitosamente.', categoria });
});
// Las categorías son compartidas: solo un administrador puede alterarlas o borrarlas.
router.patch('/:id', authorize('administrador'), bodyObject, async (req, res) => {
  const id = categoryId(req);
  const categoria = await saveCategory(categoryData(req.body, true),
    (data) => Category.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }), id);
  if (!categoria) throw httpError(404, 'La categoría no existe.');
  res.json({ mensaje: 'Categoría actualizada.', categoria });
});
router.put('/:id', authorize('administrador'), bodyObject, async (req, res) => {
  const id = categoryId(req);
  const categoria = await saveCategory(categoryData(req.body),
    (data) => Category.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }), id);
  if (!categoria) throw httpError(404, 'La categoría no existe.');
  res.json({ mensaje: 'Categoría actualizada.', categoria });
});
router.delete('/:id', authorize('administrador'), async (req, res) => {
  const id = categoryId(req);
  if (await Book.exists({ categoria: id })) throw httpError(409, 'La categoría tiene libros asociados.');
  if (!await Category.findByIdAndDelete(id)) throw httpError(404, 'La categoría no existe.');
  res.status(204).end();
});
module.exports = router;
