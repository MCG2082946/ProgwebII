const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Ajusta la ruta si tu modelo se llama o está en otro lugar

// ==========================================
// RUTA: Registro de usuario
// POST /api/auth/register (o /api/auth/registro)
// ==========================================
router.post('/registro', async (req, res) =>  {
  try {
    const { nombre, email, password, rol } = req.body;

    // 1. Validar que vengan los campos obligatorios
    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'Todos los campos marcados con * son obligatorios' });
    }

    // 2. Verificar si el correo ya está registrado
    const existeUsuario = await User.findOne({ email });
    if (existeUsuario) {
      return res.status(400).json({ mensaje: 'El correo electrónico ya está registrado' });
    }

    // 3. Encriptar la contraseña
    const salt = await bcrypt.genSalt(10);
    const contrasena_hash = await bcrypt.hash(password, salt);

    // 4. Mapear el rol enviado por el frontend ('client' -> 'cliente', 'seller' -> 'vendedor')
    // Esto resuelve el ValidationError de Mongoose
    let rolMongoose = 'cliente';
    if (rol === 'seller' || rol === 'vendedor') {
      rolMongoose = 'vendedor';
    } else if (rol === 'client' || rol === 'cliente') {
      rolMongoose = 'cliente';
    }

    // 5. Crear el nuevo usuario
    const nuevoUsuario = new User({
      nombre,
      email,
      contrasena_hash,
      rol: rolMongoose
    });

    // 6. Guardar en la base de datos
    await nuevoUsuario.save();

    // 7. Generar el Token JWT
    const token = jwt.sign(
      { id: nuevoUsuario._id, rol: nuevoUsuario.rol },
      process.env.JWT_SECRET || 'secreto_super_seguro',
      { expiresIn: '8h' }
    );

    // 8. Responder al frontend
    res.status(201).json({
      mensaje: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: nuevoUsuario._id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      mensaje: 'Error al registrar usuario', 
      error: error.message 
    });
  }
});

// ==========================================
// RUTA: Inicio de sesión
// POST /api/auth/login
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Verificar si el usuario existe
    const usuario = await User.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ mensaje: 'Credenciales inválidas' });
    }

    // 2. Validar la contraseña
    const esPasswordCorrecto = await bcrypt.compare(password, usuario.contrasena_hash);
    if (!esPasswordCorrecto) {
      return res.status(400).json({ mensaje: 'Credenciales inválidas' });
    }

    // 3. Generar JWT
    const token = jwt.sign(
      { id: usuario._id, rol: usuario.rol },
      process.env.JWT_SECRET || 'secreto_super_seguro',
      { expiresIn: '8h' }
    );

    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      mensaje: 'Error al iniciar sesión', 
      error: error.message 
    });
  }
});

module.exports = router;