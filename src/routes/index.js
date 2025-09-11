// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importar rutas
const clientRoutes = require('./clients');
const invoiceRoutes = require('./invoices');
const rifRoutes = require('./rif');
const registerRoutes = require('./register'); // ← Nueva ruta

// Rutas públicas
router.use('/clients', clientRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/rif', rifRoutes);

// ✅ Nueva: Ruta de registro por link único
router.use('/register', registerRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'FacDin API funcionando correctamente'
  });
});

module.exports = router;