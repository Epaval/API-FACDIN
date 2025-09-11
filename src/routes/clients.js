// src/routes/clients.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// POST /api/clients → registro + HTML
router.post('/', clientController.createClient);

// GET /api/clients → listar clientes
router.get('/', clientController.getClients);
router.get('/', clientController.getClientByApiKey); 

// ✅ ÚNICA ruta para descargar PDF por ID
router.get('/:id/download-pdf', clientController.downloadPdf); // ← Usa uno solo

module.exports = router;