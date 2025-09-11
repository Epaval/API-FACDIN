// src/routes/rif.js
const express = require('express');
const router = express.Router();
const rifController = require('../controllers/rifController');

// Ruta pública: validar RIF
router.post('/validate-rif', rifController.validateRif);

module.exports = router;