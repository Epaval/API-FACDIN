
const express = require('express');
const router = express.Router();

// ✅ Importar middlewares correctos
const { verifyToken } = require('../middleware/authJwt'); // ← Valida JWT y inyecta req.empleado
const { tienePermiso } = require('../middleware/permisos');
const { crearNota } = require('../controllers/notaController');

// ✅ Aplicar verifyToken para autenticar al usuario
router.use(verifyToken);

// ✅ Solo los que tienen permiso pueden crear notas
router.post('/crear', tienePermiso('insertar_nota'), crearNota);

module.exports = router;