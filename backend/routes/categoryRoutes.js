const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// ==========================================
// RUTA: Crear una categoría
// POST /api/categories
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio' });
    }

    const nuevaCategoria = new Category({
      nombre,
      descripcion: descripcion || ''
    });

    await nuevaCategoria.save();

    res.status(201).json({
      mensaje: 'Categoría creada exitosamente',
      categoria: nuevaCategoria
    });

  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ mensaje: 'Error al registrar la categoría', error: error.message });
  }
});

// ==========================================
// RUTA: Obtener todas las categorías
// GET /api/categories
// ==========================================
router.get('/', async (req, res) => {
  try {
    const categorias = await Category.find();
    res.json(categorias);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ mensaje: 'Error al obtener las categorías', error: error.message });
  }
});

module.exports = router;