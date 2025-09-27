// src/controllers/verificarFacturaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

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