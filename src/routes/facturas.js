const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authJwt');
const { tienePermiso } = require('../middleware/permisos');
const { insertarFactura } = require('../controllers/facturaController');

router.use(verifyToken);

// Cajeros y supervisores pueden emitir facturas
router.post('/insertar', tienePermiso('insertar_factura'), insertarFactura);

module.exports = router;