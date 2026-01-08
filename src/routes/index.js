// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importar rutas
const clientRoutes = require('./clients');
const invoiceRoutes = require('./invoices');
const rifRoutes = require('./rif'); 
const verificarFacturaRoute = require('./verificarFactura'); 

// Rutas públicas
router.use('/clients', clientRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/rif', rifRoutes);
 

// Verificación de integridad de facturas
router.use('/', verificarFacturaRoute); 

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'FacDin API funcionando correctamente'
  });
});

module.exports = router;