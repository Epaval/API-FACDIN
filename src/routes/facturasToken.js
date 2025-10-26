const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authJwt');
const { tienePermiso } = require('../middleware/permisos');
const { insertarFactura } = require('../controllers/facturaController');

// Rutas protegidas por token (solo para insertar)
router.use(verifyToken);
router.post('/insertar', tienePermiso('insertar_factura'), insertarFactura);

module.exports = router;