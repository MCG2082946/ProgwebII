require('dotenv').config(); // MUST BE THE FIRST LINE
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 1. MIDDLEWARES (Deben ir primero para procesar JSON y CORS)
app.use(cors());
app.use(express.json());

// 2. IMPORTAR RUTAS
const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// 3. CONEXIÓN A MONGODB ATLAS
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(' Base de datos conectada con éxito'))
  .catch((err) => console.error(' Error de conexión:', err));

// 4. RUTA DE PRUEBA
app.get('/', (req, res) => {
  res.send(' Servidor del Back-End corriendo perfectamente');
});

// 5. REGISTRAR LAS RUTAS DE LA API
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});