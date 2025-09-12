// src/routes/admin.js
const express = require('express');
const router = express.Router();
const { autorizarEmpleado } = require('../middleware/authEmpleado');
const { mostrarFormulario, generarLink } = require('../controllers/adminController');

// Mostrar formulario (requiere autenticación)
router.get('/generar-link', autorizarEmpleado, mostrarFormulario);
router.post('/generar-link', autorizarEmpleado, generarLink);

module.exports = router;