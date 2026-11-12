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
    if (!text(body.nombre)) throw httpError(400, 'El nombre de categoría es obligatorio y debe ser válido.');
    data.nombre = body.nombre.trim();
  }
  if ('descripcion' in body) {
    if (typeof body.descripcion !== 'string' || body.descripcion.length > 2000) throw httpError(400, 'Descripción inválida.');
    data.descripcion = body.descripcion.trim();
  }
  if (!Object.keys(data).length) throw httpError(400, 'No hay cambios para guardar.');
  return data;
}
function categoryId(req) {
  if (!objectId(req.params.id)) throw httpError(400, 'Identificador de categoría inválido.');
  return req.params.id;
}
router.post('/', bodyObject, async (req, res) => {
  const categoria = await Category.create(categoryData(req.body));
  res.status(201).json({ mensaje: 'Categoría creada exitosamente.', categoria });
});
// Las categorías son compartidas: solo un administrador puede alterarlas o borrarlas.
router.patch('/:id', authorize('administrador'), bodyObject, async (req, res) => {
  const id = categoryId(req);
  const categoria = await Category.findByIdAndUpdate(id, { $set: categoryData(req.body, true) }, { new: true, runValidators: true });
  if (!categoria) throw httpError(404, 'La categoría no existe.');
  res.json({ mensaje: 'Categoría actualizada.', categoria });
});
router.put('/:id', authorize('administrador'), bodyObject, async (req, res) => {
  const id = categoryId(req);
  const categoria = await Category.findByIdAndUpdate(id, { $set: categoryData(req.body) }, { new: true, runValidators: true });
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
