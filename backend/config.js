function validateConfig(env = process.env) {
  for (const key of ['JWT_SECRET', 'MONGO_URI']) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      throw new Error(`Configuración incompleta: falta ${key}.`);
    }
  }
}
module.exports = { validateConfig };
