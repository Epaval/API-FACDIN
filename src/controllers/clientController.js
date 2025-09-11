// src/controllers/clientController.js
const { Client } = require('../models');
const crypto = require('crypto');
const { validateRif } = require('../utils/validateRif');
const { generarPdfBienvenida } = require('../services/pdfService');

const generateApiKey = () => {
  const prefix = process.env.API_KEY_PREFIX || 'fcd_';
  const randomPart = crypto.randomBytes(24).toString('hex');
  return `${prefix}${randomPart}`;
};

// Genera el comprobante HTML
const generarComprobanteHtml = (client) => {
  const fecha = new Date(client.fechaCreacion).toLocaleString('es-VE', {
    timeZone: 'America/Caracas'
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Comprobante de Registro - FacDin</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; background: #f4f6f9; color: #333; }
    .container { max-width: 600px; margin: auto; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 30px; }
    h1 { color: #0056b3; text-align: center; }
    .info { margin: 20px 0; line-height: 1.8; }
    .info strong { display: inline-block; width: 140px; color: #0056b3; }
    .btn { 
      display: block; margin: 30px auto; padding: 12px 24px; background: #007bff; color: white; 
      text-align: center; text-decoration: none; border-radius: 6px; width: fit-content; font-size: 16px;
    }
    .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ Registro Exitoso</h1>
    <div class="info">
      <p><strong>Empresa:</strong> ${client.name}</p>
      <p><strong>RIF:</strong> ${client.rif}</p>
      <p><strong>API Key:</strong> <code>${client.apiKey}</code></p>
      <p><strong>Fecha y Hora:</strong> ${fecha}</p>
    </div>
    <a href="/api/clients/download-pdf/${client.id}" class="btn">
      📥 Descargar Comprobante en PDF
    </a>
    <div class="footer">
      <p>FacDin - Sistema de Facturación Digital Venezuela</p>
      <p>Este documento certifica su registro oficial.</p>
    </div>
  </div>
</body>
</html>`;
};

// ✅ Exporta createClient (el nombre usado en la ruta)
exports.createClient = async (req, res) => {
  const { name, rif } = req.body;

  if (!name || !rif) {
    return res.status(400).send(`
      <h1>❌ Error</h1>
      <p>Los campos "name" y "rif" son obligatorios.</p>
    `);
  }

  if (!validateRif(rif)) {
    return res.status(400).send(`
      <h1>❌ RIF Inválido</h1>
      <p>El formato del RIF no es válido.</p>
    `);
  }

  try {
    const existingClient = await Client.findOne({ where: { rif } });
    if (existingClient) {
      return res.status(409).send(`
        <h1>⚠️ Cliente Existente</h1>
        <p>Ya existe un cliente con este RIF.</p>
      `);
    }

    let apiKey;
    let isUnique = false;
    while (!isUnique) {
      apiKey = generateApiKey();
      const existing = await Client.findOne({ where: { apiKey } });
      if (!existing) isUnique = true;
    }

    const client = await Client.create({
      name,
      rif,
      apiKey,
      active: true
    });

    // ✅ Enviar página HTML con botón de descarga
    res.send(generarComprobanteHtml(client.toJSON()));

  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).send('<h1>❌ Error Interno</h1><p>No se pudo completar el registro.</p>');
  }
};

// ✅ Listar clientes
exports.getClients = async (req, res) => {
  try {
    const clients = await Client.findAll({
      attributes: ['id', 'name', 'rif', 'active', 'fechaCreacion']
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clientes.' });
  }
};

// ✅ Descargar PDF
exports.downloadPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).send('<h1>Cliente no encontrado</h1>');
    }

    const pdfBytes = await generarPdfBienvenida(client.toJSON());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="registro_${client.id}.pdf"`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).send('<h1>Error al generar PDF</h1>');
  }
};

exports.getClientByApiKey = async (req, res) => {
  const { apiKey } = req.query;
  console.log('🔍 API Key recibida:', apiKey);

  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey es requerido' });
  }

  try {
    const client = await Client.findOne({
      where: { apiKey },
      attributes: ['id', 'name', 'rif', 'fechaCreacion']
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error interno:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};