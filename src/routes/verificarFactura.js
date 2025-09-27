// src/routes/verificarFactura.js
const express = require('express');
const router = express.Router();
const { verificarFactura } = require('../controllers/verificarFacturaController');

/**
 * GET /api/facturas/verificar/:numeroFactura
 * Verifica la integridad de una factura por su número
 */
router.get('/facturas/verificar/:numeroFactura', verificarFactura);

module.exports = router;