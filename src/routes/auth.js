 const express = require('express');
const router = express.Router();

// Cargar modelo Client
const { Client } = require('../models');

// Cargar controladores con manejo de errores
let login, logout;
try {
  const authController = require('../controllers/authController');
  login = authController.login;
  logout = authController.logout;
  
  if (typeof login !== 'function' || typeof logout !== 'function') {
    throw new Error('authController no exporta funciones válidas');
  }
} catch (error) {
  console.error('❌ FATAL: No se pudo cargar authController:', error.message);
  console.error('💡 Asegúrate de que bcrypt, jsonwebtoken y otros estén en "dependencies" (no "devDependencies")');
  process.exit(1);
}

// Rutas de autenticación
router.post('/login', login);
router.post('/logout', logout);

// Validación de API Key
router.get('/validar-api-key', async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API Key es requerida' });
  }

  try {
    const client = await Client.findOne({
      where: { apiKey, active: true },
      attributes: ['id', 'name', 'rif']
    });

    if (!client) {
      return res.status(403).json({ error: 'API Key inválida o inactiva' });
    }

    res.json({
      clientId: client.id,
      nombre: client.name,
      rif: client.rif
    });

  } catch (error) {
    console.error('Error al validar API Key:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;