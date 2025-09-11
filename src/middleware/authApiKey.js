// src/middleware/authApiKey.js
const db = require('../models'); 

const authApiKey = async (req, res, next) => {
  console.log('🔐 [authApiKey] Iniciando autenticación...');
  const apiKey = req.headers['x-api-key'];
  console.log('🔐 [authApiKey] API Key recibida:', apiKey);

  if (!apiKey) {
    return res.status(401).json({
      error: 'Acceso denegado. Se requiere API Key.'
    });
  }

  const prefix = process.env.API_KEY_PREFIX || 'fcd_';
  if (!apiKey.startsWith(prefix)) {
    console.log('🔐 [authApiKey] Formato inválido');
    return res.status(401).json({
      error: 'API Key inválida.'
    });
  }

  try {
    console.log('🔍 [authApiKey] Buscando cliente con apiKey...');
    const client = await db.Client.findOne({ where: { apiKey, active: true } });

    if (!client) {
      console.log('❌ [authApiKey] Cliente no encontrado o desactivado');
      return res.status(401).json({
        error: 'API Key no válida o desactivada.'
      });
    }

    console.log('✅ [authApiKey] Autenticación exitosa para cliente:', client.name);
    req.client = client;
    next();
  } catch (error) {
    console.error('🚨 [authApiKey] Error interno:', error.message);
    res.status(500).json({ error: 'Error en la autenticación.' });
  }
};

module.exports = authApiKey;