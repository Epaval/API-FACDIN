// src/controllers/facturaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');
const redis = require('../config/redis');
const crypto = require('crypto'); // 🔐 Importar crypto

/**
 * Endpoint público: Insertar una factura real
 */
exports.insertarFactura = async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Acceso denegado. Se requiere API Key.'
    });
  }

  const {
    rifReceptor,
    razonSocialReceptor,
    detalles
  } = req.body;

  // Validación básica
  if (!rifReceptor || !razonSocialReceptor || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({
      error: 'Faltan campos obligatorios: rifReceptor, razonSocialReceptor, detalles'
    });
  }

  for (const det of detalles) {
    if (!det.descripcion || det.precioUnitario == null || det.cantidad == null) {
      return res.status(400).json({
        error: 'Cada detalle debe tener: descripcion, precioUnitario, cantidad'
      });
    }
  }

  const t = await sequelize.transaction();

  try {
    // Buscar cliente por apiKey
    const client = await Client.findOne({
      where: { apiKey },
      attributes: ['id', 'name', 'rif'],
      transaction: t
    });

    if (!client) {
      await t.rollback();
      return res.status(403).json({ error: 'API Key inválida o no autorizada.' });
    }

    const schema = `cliente_${client.id}`;

    // 🔑 Obtener datos de la caja desde Redis
    const cajaDataStr = await redis.get(`caja:${client.id}`);
    const cajaData = cajaDataStr ? JSON.parse(cajaDataStr) : null;

    if (!cajaData) {
      await t.rollback();
      return res.status(400).json({
        error: 'Debe abrir la caja antes de emitir facturas.'
      });
    }

    const { cajaId, impresoraFiscal } = cajaData;

    // Verificar que el esquema existe
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`
    );

    if (schemas.length === 0) {
      await t.rollback();
      return res.status(500).json({ error: 'El esquema del cliente no existe.' });
    }

    // 🔒 Obtener y actualizar contador
    const [contador] = await sequelize.query(
      `SELECT * FROM "${schema}"."contador" FOR UPDATE`,
      { transaction: t }
    );

    if (!contador || contador.length === 0) {
      await t.rollback();
      return res.status(500).json({ error: 'No se pudo obtener el contador de facturación.' });
    }

    const nuevoNumeroFactura = contador[0].ultimo_numero_factura + 1;
    const nuevoNumeroControl = contador[0].ultimo_numero_control + 1;

    await sequelize.query(
      `UPDATE "${schema}"."contador" 
       SET ultimo_numero_factura = $1, 
           ultimo_numero_control = $2,
           fecha_actualizacion = NOW()
       WHERE id = $3`,
      {
        replacements: [nuevoNumeroFactura, nuevoNumeroControl, contador[0].id],
        transaction: t
      }
    );

    // Calcular totales
    const subtotal = detalles.reduce((sum, d) => sum + (d.precioUnitario * d.cantidad), 0);
    const iva = parseFloat((subtotal * 0.16).toFixed(2));
    const total = subtotal + iva;

    // 🔐 Preparar datos para el hash (solo campos críticos)
    const dataParaHash = {
      numeroFactura: `F${nuevoNumeroFactura.toString().padStart(8, '0')}`,
      rifEmisor: client.rif,
      razonSocialEmisor: client.name,
      rifReceptor,
      razonSocialReceptor,
      fechaEmision: new Date().toISOString().split('T')[0],
      subtotal,
      iva,
      total,
      cajaId,
      impresoraFiscal,
      detalles: detalles.map(d => ({
        descripcion: d.descripcion.trim(),
        cantidad: Number(d.cantidad),
        precioUnitario: Number(d.precioUnitario),
        montoTotal: Number((d.cantidad * d.precioUnitario).toFixed(2))
      }))
    };

    // 🔐 Generar hash SHA-256
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataParaHash))
      .digest('hex');

    // Insertar factura
    const [factura] = await sequelize.query(
      `INSERT INTO "${schema}"."facturas" 
       (numero_factura, rif_emisor, razon_social_emisor, rif_receptor, razon_social_receptor, 
        fecha_emision, subtotal, iva, total, estado, "cajaId", "impresoraFiscal", hash) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, 'registrada', $9, $10, $11) 
       RETURNING id`,
      {
        replacements: [
          dataParaHash.numeroFactura,
          client.rif,
          client.name,
          rifReceptor,
          razonSocialReceptor,
          subtotal,
          iva,
          total,
          cajaId,
          impresoraFiscal,
          hash // ✅ Guardar hash
        ],
        transaction: t,
        type: sequelize.QueryTypes.INSERT
      }
    );

    const facturaId = factura[0].id;

    // Insertar detalles
    for (const det of detalles) {
      await sequelize.query(
        `INSERT INTO "${schema}"."detalles_factura" 
         (factura_id, descripcion, cantidad, precio_unitario, monto_total) 
         VALUES ($1, $2, $3, $4, $5)`,
        {
          replacements: [
            facturaId,
            det.descripcion.trim(),
            det.cantidad,
            det.precioUnitario,
            det.cantidad * det.precioUnitario
          ],
          transaction: t
        }
      );
    }

    // Registrar evento
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos" 
       (accion, entidad, entidad_id, detalle, usuario, ip, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      {
        replacements: [
          'crear_factura',
          'factura',
          facturaId,
          `Factura registrada vía API (hash: ${hash})`,
          req.headers['user-agent']?.substring(0, 100) || 'desconocido',
          req.ip || '127.0.0.1',
          req.headers['user-agent']?.substring(0, 200) || ''
        ],
        transaction: t
      }
    );

    await t.commit();

    // ✅ Respuesta con hash incluido
    res.json({
      message: '✅ Factura registrada exitosamente',
      numeroFactura: dataParaHash.numeroFactura,
      numeroControl: `NC${nuevoNumeroControl.toString().padStart(8, '0')}`,
      total: total.toFixed(2),
      fechaEmision: dataParaHash.fechaEmision,
      cliente: {
        emisor: client.name,
        receptor: razonSocialReceptor
      },
      hash // 🔐 Incluir hash en la respuesta
    });

  } catch (error) {
    await t.rollback();
    console.error('Error al registrar factura:', error);
    res.status(500).json({
      error: 'No se pudo registrar la factura',
      detalle: error.message
    });
  }
};


exports.verificarBlockchain = async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ valido: false, error: 'Acceso denegado. Se requiere API Key.' });
  }

  try {
    // Buscar cliente por apiKey
    const client = await Client.findOne({
      where: { apiKey },
      attributes: ['id', 'name']
    });

    if (!client) {
      return res.status(403).json({ valido: false, error: 'API Key inválida o no autorizada.' });
    }

    const schema = `cliente_${client.id}`;

    // Obtener todas las facturas ordenadas por ID
    const [facturas] = await sequelize.query(
      `SELECT id, numero_factura, hash_anterior, hash_actual FROM "${schema}"."facturas" ORDER BY id`,
      { type: sequelize.QueryTypes.SELECT }
    );

    if (facturas.length === 0) {
      return res.json({
        cadena_valida: true,
        total_facturas: 0,
        mensaje: 'No hay facturas registradas.'
      });
    }

    let hash_anterior_calculado = null;
    const errores = [];

    for (const f of facturas) {
      // Recalcular lo que debería ser el hash_actual
      const fakeData = {
        id: f.id,
        numero_factura: f.numero_factura,
        hash_anterior: hash_anterior_calculado
      };

      const hashCalculado = crypto
        .createHash('sha256')
        .update(JSON.stringify(fakeData))
        .digest('hex');

      // Verificar hash_actual
      if (hashCalculado !== f.hash_actual) {
        errores.push({
          id: f.id,
          numero: f.numero_factura,
          error: 'hash_actual no coincide',
          esperado: hashCalculado,
          encontrado: f.hash_actual
        });
      }

      // Verificar que el hash_anterior coincida con el anterior real
      if (f.hash_anterior !== hash_anterior_calculado) {
        errores.push({
          id: f.id,
          numero: f.numero_factura,
          error: 'hash_anterior roto',
          esperado: hash_anterior_calculado,
          encontrado: f.hash_anterior
        });
      }

      // Actualizar el hash anterior para la siguiente iteración
      hash_anterior_calculado = f.hash_actual;
    }

    res.json({
      cadena_valida: errores.length === 0,
      total_facturas: facturas.length,
      errores,
      mensaje: errores.length === 0
        ? '✅ La cadena de facturas es válida e inmutable.'
        : '❌ La cadena ha sido alterada o es inconsistente.'
    });

  } catch (error) {
    console.error('Error al verificar blockchain:', error);
    res.status(500).json({
      valido: false,
      error: 'No se pudo verificar la cadena de facturas'
    });
  }
};