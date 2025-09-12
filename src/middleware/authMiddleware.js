// src/middleware/authMiddleware.js
const { Client } = require('../models');

/**
 * Middleware: Autenticar por API Key y inyectar schema del cliente
 */
exports.verifyApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Acceso denegado. Se requiere API Key.'
    });
  }

  try {
    // Buscar cliente por apiKey
    const client = await Client.findOne({
      where: { apiKey },
      attributes: ['id', 'name', 'active']
    });

    if (!client) {
      return res.status(403).json({
        error: 'API Key inválida o no autorizada.'
      });
    }

    if (!client.active) {
      return res.status(403).json({
        error: 'La cuenta de este cliente está inactiva.'
      });
    }

    // ✅ Inyectar datos del cliente en la solicitud
    req.clientId = client.id;
    req.clientName = client.name;
    req.schema = `cliente_${client.id}`; // ← El esquema que usaremos en las consultas

    // Pasar al siguiente middleware/controlador
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({
      error: 'Error interno al verificar la API Key.'
    });
  }
};