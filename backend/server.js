require('dotenv').config(); // MUST BE THE FIRST LINE
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(' Base de datos conectada con éxito'))
  .catch((err) => console.error(' Error de conexión:', err));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send(' Servidor del Back-End corriendo perfectamente');
});

// Rutas de la API
app.use('/api/auth', require('./routes/authRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});