// src/routes/facturas.js
const express = require('express');
const router = express.Router();
const { insertarFactura } = require('../controllers/facturaController');

// ✅ Endpoint público: Insertar factura con x-api-key
router.post('/insertar', insertarFactura);

module.exports = router;