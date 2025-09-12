// src/routes/clients.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// POST /api/clients → crear cliente
router.post('/', clientController.createClient);

// GET /api/clients → listar clientes (opcional)
router.get('/', clientController.getClients);

// ✅ Nueva ruta clara para buscar por apiKey
router.get('/by-api-key', clientController.getClientByApiKey); // ← Ruta única

// ✅ Ruta correcta: /api/clients/:id/download-pdf
router.get('/:id/download-pdf', clientController.downloadPdf);

module.exports = router;