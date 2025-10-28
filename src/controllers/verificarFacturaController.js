// src/controllers/verificarFacturaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');

/**
 * Endpoint público: Verificar integridad de una factura
 * GET /api/facturas/verificar/:numeroFactura
 */
exports.verificarFactura = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { numeroFactura } = req.params;

  if (!apiKey) {
    return res.status(401).json({
      valido: false,
      error: 'Acceso denegado. Se requiere API Key.'
    });
  }

  if (!numeroFactura) {
    return res.status(400).json({
      valido: false,
      error: 'Número de factura requerido.'
    });
  }

  try {
    // Buscar cliente por apiKey
    const client = await Client.findOne({
      where: { apiKey },
      attributes: ['id', 'name', 'rif'],
    });

    if (!client) {
      return res.status(403).json({
        valido: false,
        error: 'API Key inválida o no autorizada.'
      });
    }

    const schema = `cliente_${client.id}`;

    // Obtener factura desde el schema del cliente
    const [factura] = await sequelize.query(
      `SELECT 
         id, numero_factura, rif_emisor, razon_social_emisor,
         rif_receptor, razon_social_receptor, fecha_emision,
         subtotal, iva, total, "cajaId", "impresoraFiscal", hash
       FROM "${schema}"."facturas"
       WHERE numero_factura = :numeroFactura`,
      {
        replacements: { numeroFactura },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!factura) {
      return res.status(404).json({
        valido: false,
        error: 'Factura no encontrada.'
      });
    }

    // Obtener detalles de la factura
    const detalles = await sequelize.query(
      `SELECT descripcion, cantidad, precio_unitario, monto_total
       FROM "${schema}"."detalles_factura"
       WHERE factura_id = :facturaId
       ORDER BY id`,
      {
        replacements: { facturaId: factura.id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    // Preparar datos para recalcular el hash
    const dataParaHash = {
      numeroFactura: factura.numero_factura,
      rifEmisor: factura.rif_emisor,
      razonSocialEmisor: factura.razon_social_emisor,
      rifReceptor: factura.rif_receptor,
      razonSocialReceptor: factura.razon_social_receptor,
      fechaEmision: factura.fecha_emision.toISOString().split('T')[0],
      subtotal: Number(factura.subtotal),
      iva: Number(factura.iva),
      total: Number(factura.total),
      cajaId: factura.cajaId,
      impresoraFiscal: factura.impresoraFiscal,
      detalles: detalles.map(d => ({
        descripcion: d.descripcion,
        cantidad: Number(d.cantidad),
        precioUnitario: Number(d.precio_unitario),
        montoTotal: Number(d.monto_total)
      }))
    };

    // Recalcular hash
    const hashCalculado = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataParaHash))
      .digest('hex');

    const esValido = hashCalculado === factura.hash;

    // Registrar evento de verificación
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos" 
       (accion, entidad, entidad_id, detalle, usuario, ip, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          'verificar_factura',
          'factura',
          factura.id,
          `Verificación de integridad: ${esValido ? 'éxito' : 'fallida'}`,
          req.get('User-Agent')?.substring(0, 100) || 'desconocido',
          req.ip || '127.0.0.1',
          req.get('User-Agent')?.substring(0, 200) || ''
        ]
      }
    );

    // Respuesta final
    res.json({
      valido: esValido,
      factura: {
        numeroFactura: factura.numero_factura,
        rifEmisor: factura.rif_emisor,
        razonSocialEmisor: factura.razon_social_emisor,
        rifReceptor: factura.rif_receptor,
        razonSocialReceptor: factura.razon_social_receptor,
        fechaEmision: dataParaHash.fechaEmision,
        subtotal: dataParaHash.subtotal,
        iva: dataParaHash.iva,
        total: dataParaHash.total,
        cajaId: dataParaHash.cajaId,
        impresoraFiscal: dataParaHash.impresoraFiscal,
        hashAlmacenado: factura.hash,
        hashCalculado,
        detalles: dataParaHash.detalles
      },
      mensaje: esValido
        ? '✅ Esta factura es auténtica y no ha sido alterada.'
        : '⚠️ ADVERTENCIA: Esta factura ha sido modificada o es fraudulenta.'
    });

  } catch (error) {
    console.error('Error al verificar factura:', error);
    res.status(500).json({
      valido: false,
      error: 'No se pudo verificar la factura'
    });
  }
};

/**
 * Endpoint público: Obtener facturas recientes de un cliente con paginación y búsqueda
 * GET /api/facturas/recientes
 */
exports.obtenerFacturasRecientes = async (req, res) => {
  const { limit = 5, offset = 0, search = '' } = req.query;
  const client = req.client;

  try {
    const schema = `cliente_${client.id}`;
    let whereClause = '';
    let replacements = { limit: parseInt(limit), offset: parseInt(offset) };

    if (search) {
      whereClause = `WHERE numero_factura ILIKE :search OR razon_social_receptor ILIKE :search`;
      replacements.search = `%${search}%`;
    }

    // Obtener facturas con paginación y búsqueda
    const facturas = await sequelize.query(
      `SELECT 
         id, numero_factura, razon_social_receptor, total, fecha_emision
       FROM "${schema}"."facturas"
       ${whereClause}
       ORDER BY id DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    // Contar total de facturas para paginación
    const [{ count }] = await sequelize.query(
      `SELECT COUNT(*) as count
       FROM "${schema}"."facturas"
       ${whereClause}`,
      {
        replacements: search ? { search: `%${search}%` } : {},
        type: QueryTypes.SELECT
      }
    );

    // Formatear respuesta para el dashboard
    const facturasFormateadas = facturas.map(f => ({
      id: f.id,
      numero: f.numero_factura,
      cliente: f.razon_social_receptor,
      total: f.total ? parseFloat(f.total).toFixed(2) : '0.00',
      fecha: f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString() : 'N/A'
    }));

    res.json({
      data: facturasFormateadas,
      total: parseInt(count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error al obtener facturas recientes:', error);
    res.status(500).json({
      error: 'No se pudieron obtener las facturas'
    });
  }
};

/**
 * Endpoint para obtener detalles de una factura incluyendo notas asociadas
 * GET /api/facturas/detalle/:facturaId
 */
exports.obtenerDetalleFactura = async (req, res) => {
  const { facturaId } = req.params;
  const client = req.client;

  try {
    const schema = `cliente_${client.id}`;

    // Obtener factura
    const [factura] = await sequelize.query(
      `SELECT 
         id, numero_factura, razon_social_receptor, rif_receptor, total, subtotal, iva, fecha_emision
       FROM "${schema}"."facturas"
       WHERE id = :facturaId`,
      {
        replacements: { facturaId },
        type: QueryTypes.SELECT
      }
    );

    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    // Obtener detalles de la factura
    const detalles = await sequelize.query(
      `SELECT descripcion, cantidad, precio_unitario, monto_total
       FROM "${schema}"."detalles_factura"
       WHERE factura_id = :facturaId
       ORDER BY id`,
      {
        replacements: { facturaId },
        type: QueryTypes.SELECT
      }
    );

    // ✅ Obtener notas asociadas a la factura
    const notas = await sequelize.query(
      `SELECT 
         id, numero_control, tipo, motivo, monto_afectado, fecha_emision, estado
       FROM "${schema}"."notas_credito_debito"
       WHERE factura_id = :facturaId AND estado != 'anulada'
       ORDER BY fecha_emision DESC`,
      {
        replacements: { facturaId },
        type: QueryTypes.SELECT
      }
    );

    res.json({
      factura: {
        ...factura,
        total: factura.total ? parseFloat(factura.total).toFixed(2) : '0.00',
        subtotal: factura.subtotal ? parseFloat(factura.subtotal).toFixed(2) : '0.00',
        iva: factura.iva ? parseFloat(factura.iva).toFixed(2) : '0.00',
        fecha: factura.fecha_emision ? new Date(factura.fecha_emision).toLocaleDateString() : 'N/A'
      },
      detalles,
      notas // ✅ Incluimos las notas en la respuesta
    });

  } catch (error) {
    console.error('Error al obtener detalle de factura:', error);
    res.status(500).json({
      error: 'No se pudo obtener el detalle de la factura'
    });
  }
};