// src/routes/facturas.js
const express = require('express');
const router = express.Router();
const verificarFacturaController = require('../controllers/verificarFacturaController');
const authApiKey = require('../middleware/authApiKey');

// Rutas protegidas por API Key
router.use(authApiKey);

// RUTAS ESPECÍFICAS (antes de la ruta de ID)
router.get('/recientes', verificarFacturaController.obtenerFacturasRecientes);
router.get('/detalle/:facturaId', verificarFacturaController.obtenerDetalleFactura);

// Ruta para verificar factura por número (debe ir al final)
router.get('/:numeroFactura', verificarFacturaController.verificarFactura);

module.exports = router;