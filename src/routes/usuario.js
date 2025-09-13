// src/routes/usuario.js
const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// ✅ Validación opcional (puedes eliminarla después)
console.log('🔍 Controlador cargado:', {
  registrarUsuario: typeof usuarioController.registrarUsuario,
  login: typeof usuarioController.login
});

router.post('/registrar', usuarioController.registrarUsuario);
router.post('/login', usuarioController.login);

module.exports = router;