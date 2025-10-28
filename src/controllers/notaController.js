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

  // ✅ Convertir monto_afectado a número
  const montoNumerico = parseFloat(monto_afectado);
  
  if (isNaN(montoNumerico) || montoNumerico <= 0) {
    return res.status(400).json({
      error: 'El monto afectado debe ser un número válido mayor que cero'
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
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
      { replacements: [schema], type: sequelize.QueryTypes.SELECT, transaction: t }
    );
    if (schemas.length === 0) {
      await t.rollback();
      return res.status(500).json({ error: 'Esquema del cliente no encontrado' });
    }

    // Verificar que la factura exista
    const [facturas] = await sequelize.query(
      `SELECT id, numero_factura, total, estado FROM "${schema}"."facturas" WHERE id = ?`,
      { replacements: [factura_id], transaction: t, type: sequelize.QueryTypes.SELECT }
    );

    console.log('🔍 Resultado de búsqueda de factura:', facturas); // Log para depurar
    console.log('🔍 Tipo de resultado:', typeof facturas); // Log para depurar

    // ✅ Corrección: Detectar si es un array o un objeto
    let factura;
    if (Array.isArray(facturas) && facturas.length > 0) {
      factura = facturas[0];
    } else if (facturas && typeof facturas === 'object' && Object.keys(facturas).length > 0) {
      factura = facturas;
    } else {
      factura = null;
    }

    if (!factura) {
      await t.rollback();
      console.log(`❌ Factura con ID ${factura_id} no encontrada en esquema ${schema}`);
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    if (factura.estado !== "registrada") {
      await t.rollback();
      return res.status(400).json({
        error: `No se puede emitir nota: factura en estado '${factura.estado}'`,
      });
    }

    const totalFactura = parseFloat(factura.total);

    // 🔍 Validación: No permitir notas si el monto supera el total de la factura (excepto débitos)
    if (montoNumerico > totalFactura) {
      // Solo permitir montos mayores para notas de débito
      console.log('ℹ️  Monto mayor al total, se creará nota de débito');
    }

    // 🔍 Validación avanzada: Calcular saldo disponible para notas de crédito
    if (montoNumerico <= totalFactura) {
      // Obtener suma de notas de crédito ya emitidas para esta factura
      const [notasCredito] = await sequelize.query(
        `SELECT COALESCE(SUM(monto_afectado), 0) as total_notas_credito
         FROM "${schema}"."notas_credito_debito"
         WHERE factura_id = ? AND tipo = 'credito' AND estado != 'anulada'`,
        { replacements: [factura_id], transaction: t, type: sequelize.QueryTypes.SELECT }
      );

      console.log('🔍 Notas de crédito existentes:', notasCredito); // Log para depurar

      // ✅ Corrección: Detectar si es un array o un objeto
      let totalNotasCredito = 0;
      if (Array.isArray(notasCredito) && notasCredito.length > 0) {
        totalNotasCredito = parseFloat(notasCredito[0].total_notas_credito) || 0;
      } else if (notasCredito && typeof notasCredito === 'object' && Object.keys(notasCredito).length > 0) {
        totalNotasCredito = parseFloat(notasCredito.total_notas_credito) || 0;
      }

      const saldoDisponible = totalFactura - totalNotasCredito;

      console.log('🔍 Saldo disponible para notas de crédito:', saldoDisponible); // Log para depurar

      // Validar que el nuevo monto no exceda el saldo disponible
      if (montoNumerico > saldoDisponible) {
        await t.rollback();
        return res.status(400).json({
          error: `El monto solicitado (${montoNumerico.toFixed(2)}) excede el saldo disponible (${saldoDisponible.toFixed(2)}) para notas de crédito en esta factura`,
          saldoDisponible: saldoDisponible.toFixed(2),
          totalFactura: totalFactura.toFixed(2),
          totalNotasCredito: totalNotasCredito.toFixed(2)
        });
      }

      // Si el saldo disponible es cero, no permitir más notas de crédito
      if (saldoDisponible <= 0) {
        await t.rollback();
        return res.status(400).json({
          error: 'No se pueden emitir más notas de crédito: el saldo de la factura ya ha sido totalmente compensado'
        });
      }
    }

    // 🔍 Determinar el tipo de nota según el monto
    let tipoFinal;
    if (montoNumerico > totalFactura) {
      tipoFinal = 'debito';
    } else {
      tipoFinal = 'credito';
    }

    // Generar número de control único
    const [contador] = await sequelize.query(
      `SELECT ultimo_numero_control FROM "${schema}"."contador" FOR UPDATE`,
      { transaction: t, type: sequelize.QueryTypes.SELECT }
    );

    console.log('🔍 Resultado de búsqueda de contador:', contador); // Log para depurar
    console.log('🔍 Tipo de resultado contador:', typeof contador); // Log para depurar

    // ✅ Corrección: Detectar si es un array o un objeto para el contador
    let contadorInfo;
    if (Array.isArray(contador) && contador.length > 0) {
      contadorInfo = contador[0];
    } else if (contador && typeof contador === 'object' && Object.keys(contador).length > 0) {
      contadorInfo = contador;
    } else {
      await t.rollback();
      console.log(`❌ Contador no encontrado en esquema ${schema}`);
      return res.status(500).json({ error: "Contador no encontrado" });
    }

    const nuevoNumeroControl = contadorInfo.ultimo_numero_control + 1;

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
          montoNumerico,
          `NC${nuevoNumeroControl.toString().padStart(8, '0')}`,
          req.email || 'sistema'
        ],
        type: sequelize.QueryTypes.INSERT,
        transaction: t
      }
    );

    // ✅ Solo anular factura si es Nota de Crédito con monto igual al total
    if (tipoFinal === 'credito' && montoNumerico === totalFactura) {
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
            ? (montoNumerico === totalFactura ? 'emitir_nota_credito_anulacion' : 'emitir_nota_credito_parcial')
            : 'emitir_nota_debito',
          'nota',
          nota[0].id,
          `Nota de ${tipoFinal} por ${motivo}, monto: ${montoNumerico}, afecta factura #${factura.numero_factura}`,
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
      monto: montoNumerico.toFixed(2),
      tipo: tipoFinal,
      accion: montoNumerico === totalFactura 
        ? 'factura_anulada' 
        : montoNumerico < totalFactura 
          ? 'ajuste_parcial_no_anulado' 
          : 'nota_debito'
    });

  } catch (error) {
    // ✅ Solo hacer rollback si la transacción aún está activa
    if (t && t.finished !== 'commit' && t.finished !== 'rollback') {
      await t.rollback();
    }
    console.error('Error al crear nota:', error);
    res.status(500).json({
      error: 'No se pudo crear la nota',
      detalle: error.message
    });
  }
};