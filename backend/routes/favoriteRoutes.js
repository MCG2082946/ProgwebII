const router = require('express').Router();
const { createHash } = require('node:crypto');
const Favorite = require('../models/Favorite');
const Book = require('../models/Book');
const { authenticate } = require('../middleware/auth');
const { objectId } = require('../middleware/validation');
const { httpError } = require('../middleware/errors');

router.use(authenticate);
router.get('/', async (req, res) => {
  const favorites = await Favorite.find({ id_usuario: req.user._id }).sort({ createdAt: -1 }).lean();
  const books = favorites.length ? await Book.find({ _id: { $in: favorites.map((item) => item.id_libro) } })
    .select('_id titulo autor precio portada_url categoria tipoTapa stock disponibilidad').lean() : [];
  const byId = new Map(books.map((book) => [String(book._id), book]));
  res.json(favorites.map((item) => ({ id_libro: String(item.id_libro), libro: byId.get(String(item.id_libro)) || null })));
});
router.use('/:id', (req, res, next) => {
  if (!objectId(req.params.id) || (req.body && Object.keys(req.body).length)) {
    throw httpError(400, 'Indica un libro válido y ningún campo adicional.');
  }
  next();
});
router.put('/:id', async (req, res) => {
  const filter = { id_usuario: req.user._id, id_libro: req.params.id.toLowerCase() };
  if (!await Book.findById(filter.id_libro).select('_id')) throw httpError(404, 'El libro no existe.');
  // También protege creaciones paralelas antes de terminar de crear el índice compuesto.
  const id = createHash('sha256').update(String(filter.id_usuario) + ':' + filter.id_libro).digest('hex').slice(0, 24);
  try {
    await Favorite.updateOne(filter, { $setOnInsert: { ...filter, _id: id } }, { upsert: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000 || !await Favorite.findOne(filter).lean()) throw error;
  }
  res.status(204).end();
});
router.delete('/:id', async (req, res) => {
  await Favorite.deleteMany({ id_usuario: req.user._id, id_libro: req.params.id.toLowerCase() });
  res.status(204).end();
});
module.exports = router;
