// src/controllers/notaController.js
const { Client } = require('../models');
const { sequelize } = require('../config/database');

/**
 * Crea una Nota de Crédito o Débito asociada a una factura
 * - Si monto === total factura → Nota de Crédito + factura anulada
 * - Si monto < total factura → Nota de Crédito (ajuste parcial), factura sigue activa
 * - Si monto > total factura → Nota de Débito (ajuste al alza)
 */
exports.crearNota = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { factura_id, motivo, monto_afectado } = req.body;

  // Validación básica
  if (!factura_id || !motivo || monto_afectado == null) {
    return res.status(400).json({
      error: 'factura_id, motivo y monto_afectado son obligatorios'
    });
  }

  if (monto_afectado <= 0) {
    return res.status(400).json({
      error: 'El monto afectado debe ser mayor que cero'
    });
  }

  const t = await sequelize.transaction();

  try {
    const client = await Client.findOne({ where: { apiKey } });
    if (!client) {
      await t.rollback();
      return res.status(403).json({ error: 'API Key inválida o no autorizada' });
    }

    const schema = `cliente_${client.id}`;

    // Verificar que el esquema existe
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`
    );
    if (schemas.length === 0) {
      await t.rollback();
      return res.status(500).json({ error: 'Esquema del cliente no encontrado' });
    }

    // Verificar que la factura exista
    const [facturas] = await sequelize.query(
      `SELECT id, numero_factura, total, estado FROM "${schema}"."facturas" WHERE id = ?`,
      { replacements: [factura_id], transaction: t }
    );

    const factura =
      Array.isArray(facturas) && facturas.length > 0 ? facturas[0] : null;

    if (!factura) {
      await t.rollback();
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    if (factura.estado !== "registrada") {
      await t.rollback();
      return res.status(400).json({
        error: `No se puede emitir nota: factura en estado '${factura.estado}'`,
      });
    }

    const totalFactura = parseFloat(factura.total);

    // 🔍 Determinar el tipo de nota según el monto
    let tipoFinal;
    if (monto_afectado > totalFactura) {
      tipoFinal = 'debito';
    } else {
      tipoFinal = 'credito';
    }

    // Generar número de control único
    const [contador] = await sequelize.query(
      `SELECT ultimo_numero_control FROM "${schema}"."contador" FOR UPDATE`,
      { transaction: t }
    );

    const nuevoNumeroControl = contador[0].ultimo_numero_control + 1;

    await sequelize.query(
      `UPDATE "${schema}"."contador" SET ultimo_numero_control = ?`,
      { replacements: [nuevoNumeroControl], transaction: t }
    );

    // Insertar nota
    const [nota] = await sequelize.query(
      `INSERT INTO "${schema}"."notas_credito_debito"
       (factura_id, tipo, motivo, monto_afectado, numero_control, fecha_emision, creado_por)
       VALUES (?, ?, ?, ?, ?, CURRENT_DATE, ?)
       RETURNING id`,
      {
        replacements: [
          factura_id,
          tipoFinal,
          motivo,
          monto_afectado,
          `NC${nuevoNumeroControl.toString().padStart(8, '0')}`,
          req.email || 'sistema'
        ],
        type: sequelize.QueryTypes.INSERT,
        transaction: t
      }
    );

    // ✅ Solo anular factura si es Nota de Crédito con monto igual al total
    if (tipoFinal === 'credito' && monto_afectado === totalFactura) {
      await sequelize.query(
        `UPDATE "${schema}"."facturas" SET estado = 'anulada' WHERE id = ?`,
        { replacements: [factura_id], transaction: t }
      );
    }
    // ⚠️ Si es Nota de Crédito con monto menor, la factura sigue activa
    // No hacemos nada más

    // Registrar evento
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos"
       (accion, entidad, entidad_id, detalle, usuario, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          tipoFinal === 'credito' 
            ? (monto_afectado === totalFactura ? 'emitir_nota_credito_anulacion' : 'emitir_nota_credito_parcial')
            : 'emitir_nota_debito',
          'nota',
          nota[0].id,
          `Nota de ${tipoFinal} por ${motivo}, monto: ${monto_afectado}, afecta factura #${factura.numero_factura}`,
          req.email || 'sistema',
          req.ip || '127.0.0.1',
          req.get('User-Agent')?.substring(0, 200) || ''
        ],
        transaction: t
      }
    );

    await t.commit();

    res.json({
      message: `✅ Nota de ${tipoFinal.charAt(0).toUpperCase() + tipoFinal.slice(1)} creada exitosamente`,
      notaId: nota[0].id,
      numeroControl: `NC${nuevoNumeroControl.toString().padStart(8, '0')}`,
      facturaAfectada: factura.numero_factura,
      monto: monto_afectado.toFixed(2),
      tipo: tipoFinal,
      accion: monto_afectado === totalFactura 
        ? 'factura_anulada' 
        : monto_afectado < totalFactura 
          ? 'ajuste_parcial_no_anulado' 
          : 'nota_debito'
    });

  } catch (error) {
    await t.rollback();
    console.error('Error al crear nota:', error);
    res.status(500).json({
      error: 'No se pudo crear la nota',
      detalle: error.message
    });
  }
};