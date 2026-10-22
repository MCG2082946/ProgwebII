const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Category = require('../models/Category');

// ==========================================
// RUTA: Crear un libro (vinculado a una categoría)
// POST /api/books
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { titulo, autor, categoria, precio, stock, portada_url } = req.body;

    if (!titulo || !autor || !categoria || !precio) {
      return res.status(400).json({ mensaje: 'Faltan campos obligatorios para el libro' });
    }

    // Verificar que la categoría exista antes de asociarla
    const categoriaExiste = await Category.findById(categoria);
    if (!categoriaExiste) {
      return res.status(404).json({ mensaje: 'La categoría especificada no existe' });
    }

    const nuevoLibro = new Book({
      titulo,
      autor,
      categoria, // ObjectId de la categoría
      precio,
      stock: stock || 0,
      portada_url: portada_url || ''
    });

    await nuevoLibro.save();

    res.status(201).json({
      mensaje: 'Libro creado exitosamente',
      libro: nuevoLibro
    });

  } catch (error) {
    console.error('Error al crear libro:', error);
    res.status(500).json({ mensaje: 'Error al registrar el libro', error: error.message });
  }
});

// ==========================================
// RUTA: Obtener todos los libros (con su categoría poblada)
// GET /api/books
// ==========================================
router.get('/', async (req, res) => {
  try {
    // .populate trae los detalles de la categoría relacionada
    const libros = await Book.find().populate('categoria', 'nombre descripcion');
    res.json(libros);
  } catch (error) {
    console.error('Error al obtener libros:', error);
    res.status(500).json({ mensaje: 'Error al obtener los libros', error: error.message });
  }
});

module.exports = router;