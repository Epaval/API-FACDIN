// src/controllers/facturaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');

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

    if (!client.id) {
      await t.rollback();
      return res.status(500).json({ error: 'Cliente sin ID' });
    }

    const schema = `cliente_${client.id}`;

    const caja = req.session?.caja;
    if (!caja || caja.clientId !== client.id) {
      return res.status(400).json({
        error: 'Debe abrir la caja antes de emitir facturas'
      });
    }

    const { cajaId, impresoraFiscal } = caja;

    // Verificar que el esquema existe (opcional, pero recomendado)
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`
    );

    if (schemas.length === 0) {
      await t.rollback();
      return res.status(500).json({ error: 'El esquema del cliente no existe.' });
    }

    // 🔒 Obtener y actualizar contador con bloqueo pesimista
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

    // Insertar factura
    const [factura] = await sequelize.query(
      `INSERT INTO "${schema}"."facturas" 
       (numero_factura, rif_emisor, razon_social_emisor, rif_receptor, razon_social_receptor, 
        fecha_emision, subtotal, iva, total, estado) 
       VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?, 'registrada') 
       RETURNING id`,
      {
        replacements: [
          `F${nuevoNumeroFactura.toString().padStart(8, '0')}`,
          client.rif,
          client.name,
          rifReceptor,
          razonSocialReceptor,
          subtotal,
          iva,
          total,
          cajaId,
          impresoraFiscal
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
       VALUES ('crear_factura', 'factura', ?, 'Factura registrada vía API', ?, ?, ?)`,
      {
        replacements: [
          facturaId,
          req.headers['user-agent']?.substring(0, 100) || 'desconocido',
          req.ip || '127.0.0.1',
          req.get('User-Agent')?.substring(0, 200) || ''
        ],
        transaction: t
      }
    );

    await t.commit();

    res.json({
      message: '✅ Factura registrada exitosamente',
      numeroFactura: `F${nuevoNumeroFactura.toString().padStart(8, '0')}`,
      numeroControl: `NC${nuevoNumeroControl.toString().padStart(8, '0')}`,
      total: total.toFixed(2),
      fechaEmision: new Date().toISOString().split('T')[0],
      cliente: {
        emisor: client.name,
        receptor: razonSocialReceptor
      }
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