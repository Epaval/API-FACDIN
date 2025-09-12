// src/routes/pruebas.js
const express = require('express');
const router = express.Router();
const { emitirFacturaPrueba } = require('../controllers/facturaController');
const { verifyApiKey } = require('../middleware/authMiddleware');

// Aplica autenticación
router.use(verifyApiKey);

// Ruta de prueba
router.post('/factura-prueba', emitirFacturaPrueba);

module.exports = router;