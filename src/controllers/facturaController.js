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

    const nuevoNumeroFactura = contador[0].ultimo_numero_factura + 1;
    const nuevoNumeroControl = contador[0].ultimo_numero_control + 1;

    await sequelize.query(
      `UPDATE "${schema}"."contador" 
       SET ultimo_numero_factura = ${nuevoNumeroFactura}, 
           ultimo_numero_control = ${nuevoNumeroControl},
           fecha_actualizacion = NOW()`,
      { transaction: t }
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
        descripcion: d.descripcion,
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
       VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, 'registrada', ?, ?, ?) 
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
         VALUES (?, ?, ?, ?, ?)`,
        {
          replacements: [
            facturaId,
            det.descripcion,
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
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          'crear_factura',
          'factura',
          facturaId,
          `Factura registrada vía API (hash: ${hash})`,
          req.headers['user-agent']?.substring(0, 100) || 'desconocido',
          req.ip || '127.0.0.1',
          req.get('User-Agent')?.substring(0, 200) || ''
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