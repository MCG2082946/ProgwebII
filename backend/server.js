require('dotenv').config({ quiet: true });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { validateConfig } = require('./config');
const { errorHandler } = require('./middleware/errors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.send('Servidor del Back-End disponible'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use((req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada.' }));
app.use(errorHandler);

async function start() {
  try {
    validateConfig();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const server = app.listen(process.env.PORT || 5000, () => console.log('Servidor disponible.'));
    server.on('error', () => {
      console.error('No se pudo iniciar el servidor HTTP.');
      process.exitCode = 1;
      void mongoose.disconnect();
    });
  } catch {
    console.error('No se pudo conectar con la base de datos. Revisa la configuración local.');
    process.exitCode = 1;
  }
}
if (require.main === module) void start();
module.exports = { app, start };
