require('dotenv').config({ path: './.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { validateConfig } = require('./config');
const { errorHandler } = require('./middleware/errors');
const { createFileLogger } = require('./services/eventLog');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.send('Servidor del Back-End disponible'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/favorites', require('./routes/favoriteRoutes'));
app.use((req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada.' }));
app.use(errorHandler);

async function start() {
  const eventLog = app.locals.eventLog = createFileLogger();
  await eventLog.record('servidor.arranque', 'inicio');
  try {
    validateConfig();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    await eventLog.record('servidor.arranque', 'fin', { resultado: 'fallido' });
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const server = app.listen(process.env.PORT || 5000, () => {
      console.log('Servidor disponible.');
      void eventLog.record('servidor.arranque', 'fin', { resultado: 'correcto' });
    });
    server.on('error', async () => {
      console.error('No se pudo iniciar el servidor HTTP.');
      process.exitCode = 1;
      await eventLog.record('servidor.arranque', 'fin', { resultado: 'fallido' });
      void mongoose.disconnect();
    });
  } catch {
    console.error('No se pudo iniciar la conexión con MongoDB.');
    process.exitCode = 1;
    await eventLog.record('servidor.arranque', 'fin', { resultado: 'fallido' });
  }
}
if (require.main === module) void start();
module.exports = { app, start };
