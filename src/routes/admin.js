// src/routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Middlewares
const { verifyToken } = require('../middleware/authJwt'); // Verifica JWT
const { tienePermisoFacdin } = require('../middleware/permisosFacdin'); // Permisos FACDIN-API

// Controladores
const { mostrarFormularioEnlace, generarYEnviarEnlace } = require('../controllers/enlaceController');

// 🔐 Protección 1: Verificar autenticación JWT
router.use(verifyToken);

// 🔐 Protección 2: Validar que sea empleado de FACDIN-API (@facdin.com)
router.use((req, res, next) => {
  const { email } = req.empleado || {};

  if (!email || !email.endsWith('@facdin.com')) {
    return res.status(403).json({
      error: 'Acceso denegado: solo empleados de FACDIN-API pueden acceder'
    });
  }

  // Si pasa la validación, continuar al siguiente middleware
  next();
});

// 🔐 Protección 3: Verificar permiso específico
// Este endpoint requiere el permiso 'generar_enlace'
router.use(tienePermisoFacdin('generar_enlace'));

// Rutas protegidas
router.get('/generar-enlace', mostrarFormularioEnlace);
router.post('/generar-enlace', generarYEnviarEnlace);

module.exports = router;