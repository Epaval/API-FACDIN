// src/routes/caja.js
const express = require('express');
const router = express.Router();
const { verifyApiKey } = require('../middleware/authMiddleware');
const { abrirCaja } = require('../controllers/cajaController');

router.use(verifyApiKey);

router.post('/abrir', abrirCaja);

module.exports = router;