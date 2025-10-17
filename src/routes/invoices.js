// src/routes/invoices.js
const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authApiKey = require('../middleware/authApiKey');
const facturaController = require('../controllers/facturaController');

router.use(authApiKey); // Todas las rutas requieren API Key

router.post('/', invoiceController.createInvoice);
router.get('/', invoiceController.getInvoices);
router.get('/:id', invoiceController.getInvoiceById);
router.put('/:id', invoiceController.updateInvoice);
router.get('/verificar-blockchain', facturaController.verificarBlockchain);



module.exports = router;