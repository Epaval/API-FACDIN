// src/services/clientSchemaService.js
const { sequelize } = require("../config/database");

class ClientSchemaService {
  /**
   * Crea un esquema para el cliente y todas sus tablas + contador
   * @param {number} clienteId - ID del cliente recién registrado
   */
  static async crearEsquemaParaCliente(clienteId) {
    const schemaName = `cliente_${clienteId}`;
    const t = await sequelize.transaction();

    try {
      // 1. Crear esquema
      await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`, {
        transaction: t,
      });
      console.log(`✅ Esquema "${schemaName}" creado o ya existente`);

      // 2. Crear tablas en el esquema
      await this.crearTablasEnEsquema(schemaName, clienteId, t);

      // 3. Asignar permisos (solo al usuario de la app)
      const dbUser = process.env.DB_USER || "postgres";
      await sequelize.query(
        `GRANT USAGE ON SCHEMA "${schemaName}" TO ${dbUser};`,
        { transaction: t }
      );
      await sequelize.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schemaName}" TO ${dbUser};`,
        { transaction: t }
      );

      await t.commit();
      console.log(`✅ Esquema "${schemaName}" listo para uso`);
    } catch (error) {
      await t.rollback();
      console.error(
        `❌ Error al crear esquema para cliente ${clienteId}:`,
        error.message
      );
      throw new Error(`No se pudo crear el esquema: ${error.message}`);
    }
  }

  /**
   * Crea todas las tablas dentro del esquema, incluyendo el contador
   */
  static async crearTablasEnEsquema(schemaName, clienteId, transaction) {
    const q = (sql) => sequelize.query(sql, { transaction });

    // --- 1. Contador de facturación ---
    await q(`CREATE TABLE IF NOT EXISTS "${schemaName}"."contador" (
      id SERIAL PRIMARY KEY,
      ultimo_numero_factura INT DEFAULT 0 NOT NULL,
      ultimo_numero_control INT DEFAULT 0 NOT NULL,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`);

    // Insertar registro inicial
    await q(`INSERT INTO "${schemaName}"."contador" (ultimo_numero_factura, ultimo_numero_control)
            VALUES (0, 0) ON CONFLICT DO NOTHING;`);

    // --- 2. Facturas ---
    await q(`CREATE TABLE IF NOT EXISTS "${schemaName}"."facturas" (
      id SERIAL PRIMARY KEY,
      numero_factura VARCHAR(50) NOT NULL UNIQUE,
      rif_emisor VARCHAR(20) NOT NULL,
      razon_social_emisor VARCHAR(255) NOT NULL,
      rif_receptor VARCHAR(20) NOT NULL,
      razon_social_receptor VARCHAR(255) NOT NULL,
      fecha_emision DATE NOT NULL,
      subtotal DECIMAL(15,2) NOT NULL,
      iva DECIMAL(15,2) DEFAULT 0,
      total DECIMAL(15,2) NOT NULL,
      estado VARCHAR(20) DEFAULT 'registrada',
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "cajaId" VARCHAR(10),
      "impresoraFiscal" VARCHAR(50)
    );`);

    //Índices separados (PostgreSQL no permite INDEX dentro de CREATE TABLE)
    await q(`CREATE INDEX IF NOT EXISTS idx_facturas_numero_${clienteId} 
             ON "${schemaName}"."facturas" ("numero_factura");`);
    await q(`CREATE INDEX IF NOT EXISTS idx_facturas_fecha_${clienteId} 
             ON "${schemaName}"."facturas" ("fecha_emision");`);
    await q(`CREATE INDEX IF NOT EXISTS idx_facturas_estado_${clienteId} 
             ON "${schemaName}"."facturas" ("estado");`);
    await q(`CREATE INDEX IF NOT EXISTS idx_facturas_caja_${clienteId} 
             ON "${schemaName}"."facturas" ("cajaId");`);
    await q(`CREATE INDEX IF NOT EXISTS idx_facturas_impresora_${clienteId} 
             ON "${schemaName}"."facturas" ("impresoraFiscal");`);

    // --- 3. Detalles de factura ---
    await q(`CREATE TABLE IF NOT EXISTS "${schemaName}"."detalles_factura" (
      id SERIAL PRIMARY KEY,
      factura_id INT NOT NULL,
      descripcion TEXT,
      cantidad DECIMAL(10,2) DEFAULT 1,
      precio_unitario DECIMAL(15,2) NOT NULL,
      monto_total DECIMAL(15,2) NOT NULL,
      FOREIGN KEY (factura_id) REFERENCES "${schemaName}"."facturas"(id) ON DELETE CASCADE
    );`);

    await q(`CREATE INDEX IF NOT EXISTS idx_detalles_factura_${clienteId} 
             ON "${schemaName}"."detalles_factura" ("factura_id");`);

    // --- 4. Notas de crédito/débito ---
    await q(`CREATE TABLE IF NOT EXISTS "${schemaName}"."notas_credito_debito" (
      id SERIAL PRIMARY KEY,
      factura_id INT NOT NULL,
      tipo VARCHAR(10) NOT NULL,
      motivo TEXT NOT NULL,
      monto_afectado DECIMAL(15,2) NOT NULL,
      numero_control VARCHAR(50),
      fecha_emision DATE NOT NULL,
      estado VARCHAR(20) DEFAULT 'emitida',
      creado_por VARCHAR(100),
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (factura_id) REFERENCES "${schemaName}"."facturas"(id) ON DELETE CASCADE
    );`);

    await q(`CREATE INDEX IF NOT EXISTS idx_ncd_tipo_${clienteId} 
             ON "${schemaName}"."notas_credito_debito" ("tipo");`);

    // --- 5. Usuarios autorizados ---
    await q(`CREATE TABLE IF NOT EXISTS "${schemaName}"."usuarios_autorizados" (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      rol VARCHAR(50) DEFAULT 'usuario',
      activo BOOLEAN DEFAULT TRUE,
      password_hash TEXT NOT NULL,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ultimo_acceso TIMESTAMP
    );`);

    await q(`CREATE INDEX IF NOT EXISTS idx_usuario_email_${clienteId} 
    ON "${schemaName}"."usuarios_autorizados" ("email");`);

    // --- 6. Registro de eventos ---
    await q(`CREATE TABLE IF NOT EXISTS "${schemaName}"."registro_eventos" (
      id SERIAL PRIMARY KEY,
      accion VARCHAR(100) NOT NULL,
      entidad VARCHAR(50) NOT NULL,
      entidad_id INT,
      detalle TEXT,
      usuario VARCHAR(100),
      ip VARCHAR(45),
      user_agent TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`);

    await q(`CREATE INDEX IF NOT EXISTS idx_evento_accion_${clienteId} 
             ON "${schemaName}"."registro_eventos" ("accion");`);
    await q(`CREATE INDEX IF NOT EXISTS idx_evento_fecha_${clienteId} 
             ON "${schemaName}"."registro_eventos" ("fecha");`);

    console.log(`✅ Todas las tablas creadas en el esquema "${schemaName}"`);
  }

  /**
   * Desactiva temporalmente el acceso al esquema
   */
  static async desactivarAcceso(clienteId) {
    const schemaName = `cliente_${clienteId}`;
    const dbUser = process.env.DB_USER || "postgres";

    try {
      await sequelize.query(
        `REVOKE USAGE ON SCHEMA "${schemaName}" FROM ${dbUser};`
      );
      console.log(`🔒 Acceso revocado al esquema "${schemaName}"`);
    } catch (error) {
      console.warn(
        `⚠️ No se pudo revocar acceso a "${schemaName}":`,
        error.message
      );
    }
  }

  /**
   * Reactiva el acceso al esquema
   */
  static async activarAcceso(clienteId) {
    const schemaName = `cliente_${clienteId}`;
    const dbUser = process.env.DB_USER || "postgres";

    try {
      await sequelize.query(
        `GRANT USAGE ON SCHEMA "${schemaName}" TO ${dbUser};`
      );
      console.log(`🔓 Acceso restaurado al esquema "${schemaName}"`);
    } catch (error) {
      console.error(
        `❌ No se pudo restaurar acceso a "${schemaName}":`,
        error.message
      );
      throw error;
    }
  }
}

module.exports = ClientSchemaService;