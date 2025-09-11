// src/controllers/invoiceController.js
const db = require('../models'); // ✅ Usa el index.js (recomendado)

const { Client, Invoice } = db;

exports.createInvoice = async (req, res) => {
  const { client } = req; // ✅ Cliente autenticado por API Key (de authApiKey.js)
  
  if (!client || !client.id) {
    return res.status(500).json({ error: 'Error interno: cliente no autenticado' });
  }

  const data = req.body;

  try {
    const invoice = await Invoice.create({
      ...data,
      clientId: client.id // Asociar al cliente autenticado
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error('❌ Error al crear factura:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.getInvoices = async (req, res) => {
  const { client } = req;
  
  try {
    const invoices = await Invoice.findAll({
      where: { clientId: client.id },
      attributes: ['id', 'rifEmisor', 'razonSocialEmisor', 'rifReceptor', 
                  'razonSocialReceptor', 'numeroFactura', 'subtotal', 'iva', 'total', 
                  'status', 'fechaEmision', 'fechaCreacion'],
      order: [['fechaCreacion', 'DESC']]
    });
    res.json(invoices);
  } catch (error) {
    console.error('❌ Error al obtener facturas:', error.message);
    res.status(500).json({ error: 'Error al obtener las facturas' });
  }
};

exports.getInvoiceById = async (req, res) => {
  const { client } = req;
  const { id } = req.params;

  try {
    const invoice = await Invoice.findOne({
      where: { id, clientId: client.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('❌ Error al buscar factura:', error.message);
    res.status(500).json({ error: 'Error al obtener la factura' });
  }
};

exports.updateInvoice = async (req, res) => {
  const { client } = req;
  const { id } = req.params;
  const updates = req.body;

  // ❌ No permitir cambiar el estado
  if (updates.status !== undefined) {
    return res.status(400).json({
      error: 'No se puede modificar el estado de la factura.'
    });
  }

  try {
    const invoice = await Invoice.findOne({ where: { id, clientId: client.id } });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    await invoice.update(updates);
    res.json(invoice);
  } catch (error) {
    console.error('❌ Error al actualizar factura:', error.message);
    res.status(400).json({ error: error.message });
  }
};