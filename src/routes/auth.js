const express = require('express');
const router = express.Router();
const { Client } = require('../models');

// Controladores existentes
const { login, logout } = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/validar-api-key ← NUEVO
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