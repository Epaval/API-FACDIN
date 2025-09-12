// src/controllers/cajaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Abre una caja fiscal asociada al cliente autenticado
 */
exports.abrirCaja = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { cajaId, impresoraFiscal } = req.body;

  // Validación de campos obligatorios
  if (!apiKey || !cajaId || !impresoraFiscal) {
    return res.status(400).json({
      error: 'API Key, cajaId e impresoraFiscal son obligatorios'
    });
  }

  // Sanitización básica
  const cajaIdSanitizado = cajaId.trim().toUpperCase();
  const impresoraFiscalSanitizada = impresoraFiscal.trim();

  try {
    // Buscar cliente por API Key
    const client = await Client.findOne({ where: { apiKey } });

    if (!client) {
      return res.status(403).json({ error: 'API Key inválida o no autorizada' });
    }

    const clientId = client.id;
    const schema = `cliente_${clientId}`;

    // Verificar que el esquema exista
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`
    );

    if (schemas.length === 0) {
      return res.status(500).json({
        error: 'El esquema del cliente no existe. Contacte a soporte.'
      });
    }

    // Inicializar sesión si no existe
    req.session = req.session || {};
    req.session.caja = {
      cajaId: cajaIdSanitizado,
      impresoraFiscal: impresoraFiscalSanitizada,
      clientId: clientId,
      abierta: true,
      fechaApertura: new Date().toISOString()
    };

    // Registrar evento de apertura en el esquema del cliente
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos" 
       (accion, entidad, detalle, usuario, ip, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          'apertura_caja',
          'caja',
          `Caja ${cajaIdSanitizado} abierta con impresora ${impresoraFiscalSanitizada}`,
          req.headers['user-agent']?.substring(0, 100) || 'sistema',
          req.ip || '127.0.0.1',
          req.get('User-Agent')?.substring(0, 200) || ''
        ]
      }
    );

    // Respuesta exitosa
    res.json({
      message: '✅ Caja abierta exitosamente',
      cajaId: cajaIdSanitizado,
      impresoraFiscal: impresoraFiscalSanitizada,
      cliente: client.name,
      clientId: clientId,
      schema: schema,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error crítico al abrir caja:', error);
    res.status(500).json({
      error: 'No se pudo abrir la caja',
      detalle: error.message
    });
  }
};