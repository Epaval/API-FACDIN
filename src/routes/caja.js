// src/routes/caja.js
const express = require('express');
const router = express.Router();

// Importar el controlador
const cajaController = require('../controllers/cajaController');

// Validación opcional (puedes eliminarla después)
console.log('🔍 abrirCaja es función:', typeof cajaController.abrirCaja);
console.log('🔍 cerrarCaja es función:', typeof cajaController.cerrarCaja);

if (typeof cajaController.abrirCaja !== 'function') {
  throw new Error('abrirCaja no es una función');
}
if (typeof cajaController.cerrarCaja !== 'function') {
  throw new Error('cerrarCaja no es una función');
}

// Rutas
router.post('/abrir', cajaController.abrirCaja);
router.post('/cerrar', cajaController.cerrarCaja); // ← Nueva ruta

module.exports = router;