// src/controllers/registerController.js
const { Client } = require('../models');
const { RegistrationLink } = require('../models');
const { validateRif } = require('../utils/validateRif');
const crypto = require('crypto');
const path = require('path');

/**
 * Genera una API Key única para el cliente
 * @returns {string}
 */
const generateApiKey = () => {
  const prefix = process.env.API_KEY_PREFIX || 'fcd_';
  return `${prefix}${crypto.randomBytes(24).toString('hex')}`;
};

/**
 * Muestra el formulario de registro si el link es válido
 */
exports.mostrarFormulario = async (req, res) => {
  const { token } = req.params;

  try {
    const link = await RegistrationLink.findOne({ where: { token } });

    if (!link) {
      return res.status(404).send('<h1>🔗 Link no válido</h1><p>El enlace de registro no existe.</p>');
    }

    if (link.used) {
      return res.send('<h1>🚫 Este link ya fue usado</h1><p>Este enlace solo puede usarse una vez.</p>');
    }

    if (new Date() > link.expiresAt) {
      return res.send('<h1>⏰ Este link ha expirado</h1><p>El tiempo máximo de 30 minutos ha pasado.</p>');
    }

    // Servir formulario HTML
    res.sendFile(path.join(__dirname, '../views/register.html'));

  } catch (error) {
    console.error('Error al mostrar formulario:', error);
    res.status(500).send('<h1>❌ Error interno</h1><p>No se pudo cargar el formulario.</p>');
  }
};

/**
 * Registra al cliente al completar el formulario
 */
exports.registrarCliente = async (req, res) => {
  const { token } = req.params;
  const { name, rif } = req.body;

  try {
    const link = await RegistrationLink.findOne({ where: { token } });

    if (!link) {
      return res.status(400).json({ error: 'Link no válido' });
    }

    if (link.used) {
      return res.status(400).json({ error: 'Este link ya fue usado' });
    }

    if (new Date() > link.expiresAt) {
      return res.status(400).json({ error: 'Este link ha expirado' });
    }

    if (!name || !rif) {
      return res.status(400).json({ error: 'Los campos "name" y "rif" son obligatorios.' });
    }

    if (!validateRif(rif)) {
      return res.status(400).json({ error: 'El formato del RIF no es válido.' });
    }

    // Verificar si ya existe un cliente con ese RIF
    const existing = await Client.findOne({ where: { rif } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un cliente con este RIF.' });
    }

    // Generar apiKey única
    let apiKey;
    do {
      apiKey = generateApiKey();
    } while (await Client.findOne({ where: { apiKey } }));

    // Crear nuevo cliente
    const client = await Client.create({
      name,
      rif,
      apiKey,
      active: true
    });

    // Marcar el link como usado
    await link.update({ used: true, clientId: client.id });

    // Responder con éxito y redirigir a la página de éxito
    res.json({
      message: 'Registrado exitosamente',
      apiKey: client.apiKey
    });

  } catch (error) {
    console.error('Error al registrar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Página de éxito mostrando la API Key
 */
exports.successPage = (req, res) => {
  res.sendFile(path.join(__dirname, '../views/success.html'));
};