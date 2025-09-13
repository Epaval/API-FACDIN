// src/controllers/cajaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');
const redis = require('../config/redis');

/**
 * Abre una caja fiscal asociada al cliente autenticado
 */
exports.abrirCaja = async (req, res) => {
  const { cajaId, impresoraFiscal } = req.body;
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || !cajaId || !impresoraFiscal) {
    return res.status(400).json({
      error: 'API Key, cajaId e impresoraFiscal son obligatorios'
    });
  }

  try {
    const client = await Client.findOne({ where: { apiKey } });

    if (!client) {
      return res.status(403).json({ error: 'API Key inválida o no autorizada' });
    }

    const schema = `cliente_${client.id}`;

    // Verificar que el esquema exista
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`
    );

    if (schemas.length === 0) {
      return res.status(500).json({
        error: 'El esquema del cliente no existe. Contacte a soporte.'
      });
    }

    // Guardar en Redis
    await redis.set(`caja:${client.id}`, JSON.stringify({
      cajaId,
      impresoraFiscal,
      clientId: client.id,
      abierto: true,
      fechaApertura: new Date().toISOString()
    }), { EX: 8 * 60 * 60 }); // 8 horas

    //  Obtener user_agent de forma segura
    const userAgent = req.get('User-Agent') || req.headers['user-agent'] || 'desconocido';

    // Registrar evento - ahora con 6 valores correctos
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos" 
       (accion, entidad, detalle, usuario, ip, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          'apertura_caja',                           
          'caja',                                   
          `Caja ${cajaId} abierta con impresora ${impresoraFiscal}`, 
          req.email || 'sistema',                   
          req.ip || '127.0.0.1',                  
          userAgent.substring(0, 255)               
        ]
      }
    );

    res.json({
      message: '✅ Caja abierta exitosamente',
      cajaId,
      impresoraFiscal,
      cliente: client.name,
      clientId: client.id,
      schema: schema
    });

  } catch (error) {
    console.error('Error crítico al abrir caja:', error);
    res.status(500).json({
      error: 'No se pudo abrir la caja',
      detalle: error.message
    });
  }
};

/**
 * Cierra la caja fiscal del cliente autenticado
 */
exports.cerrarCaja = async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Acceso denegado. Se requiere API Key.' });
  }

  try {
    const client = await Client.findOne({ where: { apiKey } });

    if (!client) {
      return res.status(403).json({ error: 'API Key inválida o no autorizada.' });
    }

    const schema = `cliente_${client.id}`;

    // Verificar que el esquema exista
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`
    );

    if (schemas.length === 0) {
      return res.status(500).json({ error: 'El esquema del cliente no existe.' });
    }

    // Verificar si la caja está abierta
    const cajaDataStr = await redis.get(`caja:${client.id}`);
    const cajaData = cajaDataStr ? JSON.parse(cajaDataStr) : null;

    if (!cajaData) {
      return res.status(400).json({
        error: 'La caja no está abierta o ya fue cerrada.'
      });
    }

    // Eliminar estado de Redis
    await redis.del(`caja:${client.id}`);

    // Registrar evento de cierre
    const userAgent = req.get('User-Agent') || req.headers['user-agent'] || 'desconocido';

    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos" 
       (accion, entidad, detalle, usuario, ip, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          'cierre_caja',
          'caja',
          `Caja ${cajaData.cajaId} cerrada. Impresora: ${cajaData.impresoraFiscal}`,
          req.email || 'sistema',
          req.ip || '127.0.0.1',
          userAgent.substring(0, 255)
        ]
      }
    );

    res.json({
      message: '✅ Caja cerrada exitosamente',
      cajaId: cajaData.cajaId,
      cliente: client.name,
      cerradoEn: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({
      error: 'No se pudo cerrar la caja',
      detalle: error.message
    });
  }
};