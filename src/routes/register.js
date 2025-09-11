// src/routes/register.js
const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');

// ✅ Primero: Rutas fijas
router.get('/success', registerController.successPage);

// ✅ Después: Rutas dinámicas (con :token)
router.get('/:token', registerController.mostrarFormulario);
router.post('/:token', registerController.registrarCliente);

module.exports = router;