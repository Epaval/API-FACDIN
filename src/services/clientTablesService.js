// src/services/clientTablesService.js
const { sequelize } = require('../config/database');

class ClientTablesService {
  static async crearTablasParaCliente(clienteId) {
    const name = (suffix) => `${suffix}_cliente_${clienteId}`;
    const t = await sequelize.transaction();

    try {
      // 1. Tabla: Facturas
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "${name('facturas')}" (
          id SERIAL PRIMARY KEY,
          "numeroFactura" VARCHAR(50) NOT NULL UNIQUE,
          "rifEmisor" VARCHAR(20) NOT NULL,
          "razonSocialEmisor" VARCHAR(255) NOT NULL,
          "rifReceptor" VARCHAR(20) NOT NULL,
          "razonSocialReceptor" VARCHAR(255) NOT NULL,
          "fechaEmision" DATE NOT NULL,
          "subtotal" DECIMAL(15,2) NOT NULL,
          "iva" DECIMAL(15,2) DEFAULT 0,
          "total" DECIMAL(15,2) NOT NULL,
          "estado" VARCHAR(20) DEFAULT 'registrada',
          "fechaCreacion" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, { transaction: t });

      // Índices para facturas
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_numero_factura_${clienteId} 
        ON "${name('facturas')}" ("numeroFactura");
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_fecha_emision_${clienteId} 
        ON "${name('facturas')}" ("fechaEmision");
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_estado_${clienteId} 
        ON "${name('facturas')}" ("estado");
      `, { transaction: t });

      // 2. Detalles de factura
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "${name('detalles_factura')}" (
          id SERIAL PRIMARY KEY,
          "facturaId" INTEGER NOT NULL,
          descripcion TEXT,
          cantidad DECIMAL(10,2) DEFAULT 1,
          "precioUnitario" DECIMAL(15,2) NOT NULL,
          "montoTotal" DECIMAL(15,2) NOT NULL,
          FOREIGN KEY ("facturaId") REFERENCES "${name('facturas')}"(id) ON DELETE CASCADE
        );
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_factura_id_${clienteId} 
        ON "${name('detalles_factura')}" ("facturaId");
      `, { transaction: t });

      // 3. Notas de crédito/débito
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "${name('notas_credito_debito')}" (
          id SERIAL PRIMARY KEY,
          "facturaId" INTEGER NOT NULL,
          tipo VARCHAR(10) NOT NULL,
          motivo TEXT NOT NULL,
          "montoAfectado" DECIMAL(15,2) NOT NULL,
          "numeroControl" VARCHAR(50),
          "fechaEmision" DATE NOT NULL,
          estado VARCHAR(20) DEFAULT 'emitida',
          "creadoPor" VARCHAR(100),
          "fechaCreacion" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("facturaId") REFERENCES "${name('facturas')}"(id) ON DELETE CASCADE
        );
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_ncd_tipo_${clienteId} 
        ON "${name('notas_credito_debito')}" (tipo);
      `, { transaction: t });

      // 4. Usuarios autorizados
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "${name('usuarios_autorizados')}" (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          rol VARCHAR(50) DEFAULT 'usuario',
          activo BOOLEAN DEFAULT TRUE,
          "fechaRegistro" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "ultimoAcceso" TIMESTAMP
        );
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_usuario_email_${clienteId} 
        ON "${name('usuarios_autorizados')}" (email);
      `, { transaction: t });

      // 5. Registro de eventos
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "${name('registro_eventos')}" (
          id SERIAL PRIMARY KEY,
          accion VARCHAR(100) NOT NULL,
          entidad VARCHAR(50) NOT NULL,
          "entidadId" INTEGER,
          detalle TEXT,
          usuario VARCHAR(100),
          ip VARCHAR(45),
          "userAgent" TEXT,
          fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_evento_accion_${clienteId} 
        ON "${name('registro_eventos')}" (accion);
      `, { transaction: t });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_evento_fecha_${clienteId} 
        ON "${name('registro_eventos')}" (fecha);
      `, { transaction: t });

      await t.commit();
      console.log(`✅ Todas las tablas y índices creados para cliente ${clienteId}`);
    } catch (error) {
      await t.rollback();
      console.error(`❌ Error CRÍTICO al crear tablas para cliente ${clienteId}:`, error.message);
      if (error.original) console.error('SQL Original:', error.original);
      throw new Error(`No se pudieron crear las tablas: ${error.message}`);
    }
  }
}

module.exports = ClientTablesService;