// src/controllers/facturaController.js
const { Client: ClientModel } = require('../models');
const { sequelize } = require('../config/database');
const redis = require('../config/redis');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');

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
    console.log('✅ [insertarFactura] Iniciando proceso...');
    console.log('📦 Datos recibidos:', { rifReceptor, razonSocialReceptor, detallesCount: detalles.length });
    console.log('🔑 API Key:', apiKey);

    // Buscar cliente por apiKey
    const client = await ClientModel.findOne({
      where: { apiKey },
      attributes: ['id', 'name', 'rif'],
      transaction: t
    });

    if (!client) {
      await t.rollback();
      console.warn('❌ API Key no encontrada:', apiKey);
      return res.status(403).json({ error: 'API Key inválida o no autorizada.' });
    }

    console.log('👤 Cliente encontrado:', client.toJSON());

    const schema = `cliente_${client.id}`;

    // 🔑 Obtener datos de la caja desde Redis
    let cajaData;
    try {
      const cajaDataStr = await redis.get(`caja:${client.id}`);
      cajaData = cajaDataStr ? JSON.parse(cajaDataStr) : null;
    } catch (err) {
      await t.rollback();
      console.error('🔴 Error parsing Redis ', err);
      return res.status(500).json({ error: 'Datos de caja corruptos en caché.' });
    }

    if (!cajaData || !cajaData.cajaId || !cajaData.impresoraFiscal) {
      await t.rollback();
      console.warn('⚠️ Caja no abierta para cliente:', client.id);
      return res.status(400).json({
        error: 'Debe abrir la caja antes de emitir facturas.'
      });
    }

    const { cajaId, impresoraFiscal } = cajaData;
    console.log('🖨️ Caja:', { cajaId, impresoraFiscal });

    // Verificar que el esquema existe (PostgreSQL + Transacción)
    const [schemas] = await sequelize.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      {
        bind: [schema],
        type: QueryTypes.SELECT,
        transaction: t
      }
    );

    if (schemas.length === 0) {
      await t.rollback();
      console.error('❌ Esquema no existe:', schema);
      return res.status(500).json({ error: 'El esquema del cliente no existe.' });
    }

    // 🔒 Obtener y actualizar contador
    const [contadorRaw] = await sequelize.query(
      `SELECT * FROM "${schema}"."contador" FOR UPDATE`,
      { transaction: t, type: QueryTypes.SELECT }
    );

    // ✅ Detectar si es un array o un objeto
    let contador = Array.isArray(contadorRaw) ? contadorRaw : [contadorRaw];

    let contadorId;
    let ultimo_numero_factura = 0;
    let ultimo_numero_control = 0;

    if (!contador || contador.length === 0) {
      console.log('⚠️ Contador no encontrado en esquema:', schema, 'Creando inicial...');
      const [insertResult] = await sequelize.query(
        `INSERT INTO "${schema}"."contador" (ultimo_numero_factura, ultimo_numero_control) VALUES (1, 1) RETURNING id`,
        { transaction: t, type: QueryTypes.INSERT }
      );

      console.log('🔍 Resultado del INSERT:', insertResult);

      let rawId = undefined;
      if (insertResult && Array.isArray(insertResult) && insertResult.length > 0) {
        rawId = insertResult[0].id;
      } else if (insertResult && typeof insertResult === 'object' && insertResult.id) {
        rawId = insertResult.id;
      } else {
        console.error('❌ Formato inesperado del INSERT:', insertResult);
        throw new Error('No se pudo obtener el ID del contador recién insertado');
      }

      contadorId = rawId;

      if (contadorId === undefined) {
        throw new Error('No se pudo obtener el ID del contador recién insertado');
      }
      ultimo_numero_factura = 1;
      ultimo_numero_control = 1;
    } else {
      // Si ya existía, usar valores actuales
      if (!contador[0] || typeof contador[0] !== 'object') {
        console.error('❌ El resultado de SELECT * FROM contador es inválido:', contador);
        throw new Error('El resultado de la consulta al contador es inválido');
      }
      const fila = contador[0];
      // ✅ Verificar que exista la columna 'id' antes de usarla
      if (fila.id === undefined) {
        console.error('❌ La fila del contador no tiene la columna "id":', fila);
        throw new Error('La fila del contador no tiene la columna "id"');
      }
      contadorId = fila.id;
      ultimo_numero_factura = fila.ultimo_numero_factura;
      ultimo_numero_control = fila.ultimo_numero_control;
    }

    const nuevoNumeroFactura = ultimo_numero_factura + 1;
    const nuevoNumeroControl = ultimo_numero_control + 1;

    console.log('🔍 Valores para UPDATE:', {
      nuevoNumeroFactura,
      nuevoNumeroControl,
      contadorId
    });

    if (contadorId === undefined) {
      throw new Error('contadorId es undefined antes del UPDATE');
    }

    await sequelize.query(
      `UPDATE "${schema}"."contador" 
       SET ultimo_numero_factura = $1, 
           ultimo_numero_control = $2,
           fecha_actualizacion = NOW()
       WHERE id = $3`,
      {
        bind: [nuevoNumeroFactura, nuevoNumeroControl, contadorId],
        transaction: t
      }
    );

    // Calcular totales
    const subtotal = detalles.reduce((sum, d) => {
      const monto = Number(d.precioUnitario) * Number(d.cantidad);
      if (isNaN(monto)) throw new Error('Precio o cantidad inválidos');
      return sum + monto;
    }, 0);

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

    // 🔐 Generar hash_actual SHA-256
    const hashActual = crypto
      .createHash('sha256')
      .update(JSON.stringify(dataParaHash))
      .digest('hex');

    // 🔐 Obtener hash_anterior de la última factura registrada
    const [ultimaFactura] = await sequelize.query(
      `SELECT hash_actual FROM "${schema}"."facturas" ORDER BY id DESC LIMIT 1`,
      { transaction: t, type: QueryTypes.SELECT }
    );
    const hashAnterior = ultimaFactura && ultimaFactura.length > 0 ? ultimaFactura[0].hash_actual : null;

    // Insertar factura
    const [factura] = await sequelize.query(
      `INSERT INTO "${schema}"."facturas" 
       (numero_factura, rif_emisor, razon_social_emisor, rif_receptor, razon_social_receptor, 
        fecha_emision, subtotal, iva, total, estado, "cajaId", "impresoraFiscal", hash_anterior, hash_actual) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, 'registrada', $9, $10, $11, $12) 
       RETURNING id`,
      {
        bind: [
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
          hashAnterior,
          hashActual
        ],
        transaction: t,
        type: QueryTypes.INSERT
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
          bind: [
            facturaId,
            det.descripcion.trim(),
            Number(det.cantidad),
            Number(det.precioUnitario),
            Number(det.cantidad) * Number(det.precioUnitario)
          ],
          transaction: t,
          type: QueryTypes.INSERT
        }
      );
    }

    // Registrar evento
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos" 
       (accion, entidad, entidad_id, detalle, usuario, ip, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      {
        bind: [
          'crear_factura',
          'factura',
          facturaId,
          `Factura registrada vía API (hash: ${hashActual})`,
          req.headers['user-agent']?.substring(0, 100) || 'desconocido',
          req.ip || '127.0.0.1',
          req.headers['user-agent']?.substring(0, 200) || ''
        ],
        transaction: t,
        type: QueryTypes.INSERT
      }
    );

    await t.commit();

    // ✅ Respuesta con hash incluido
    console.log('✅ Factura registrada:', { facturaId, numero: dataParaHash.numeroFactura, total });
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
      hashActual,
      hashAnterior
    });

  } catch (error) {
    await t.rollback();
    console.error('🚨 Error al registrar factura:', error.message);
    console.error('🔧 Stack:', error.stack);
    res.status(500).json({
      error: 'No se pudo registrar la factura',
      detalle: error.message
    });
  }
};

/**
 * Verificar integridad blockchain de facturas
 */
exports.verificarBlockchain = async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ valido: false, error: 'Acceso denegado. Se requiere API Key.' });
  }

  try {
    const client = await ClientModel.findOne({
      where: { apiKey },
      attributes: ['id', 'name']
    });

    if (!client) {
      return res.status(403).json({ valido: false, error: 'API Key inválida o no autorizada.' });
    }

    const schema = `cliente_${client.id}`;
    const [facturas] = await sequelize.query(
      `SELECT id, numero_factura, hash_anterior, hash_actual FROM "${schema}"."facturas" ORDER BY id`,
      { type: QueryTypes.SELECT }
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
      const fakeData = {
        id: f.id,
        numero_factura: f.numero_factura,
        hash_anterior: hash_anterior_calculado
      };

      const hashCalculado = crypto
        .createHash('sha256')
        .update(JSON.stringify(fakeData))
        .digest('hex');

      if (hashCalculado !== f.hash_actual) {
        errores.push({
          id: f.id,
          numero: f.numero_factura,
          error: 'hash_actual no coincide',
          esperado: hashCalculado,
          encontrado: f.hash_actual
        });
      }

      if (f.hash_anterior !== hash_anterior_calculado) {
        errores.push({
          id: f.id,
          numero: f.numero_factura,
          error: 'hash_anterior roto',
          esperado: hash_anterior_calculado,
          encontrado: f.hash_anterior
        });
      }

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