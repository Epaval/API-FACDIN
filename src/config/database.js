 // src/config/database.js
const { Sequelize } = require('sequelize');
const { Pool } = require('pg');

// 🚨 DIAGNÓSTICO 1: Mostrar TODAS las variables de entorno relevantes
console.log('🔍 [DATABASE.JS] DIAGNÓSTICO DE VARIABLES DE ENTORNO:');
console.log('   DB_HOST:', process.env.DB_HOST || '❌ NO DEFINIDO');
console.log('   DB_PORT:', process.env.DB_PORT || '❌ NO DEFINIDO');
console.log('   DB_NAME:', process.env.DB_NAME || '❌ NO DEFINIDO');
console.log('   DB_USER:', process.env.DB_USER || '❌ NO DEFINIDO');
console.log('   DB_PASS:', process.env.DB_PASS ? '✅ DEFINIDO (oculto por seguridad)' : '❌ NO DEFINIDO');

// Validación de variables requeridas
const {
  DB_NAME,
  DB_USER,
  DB_PASS,
  DB_HOST,
  DB_PORT
} = process.env;

if (!DB_NAME || !DB_USER || !DB_PASS || !DB_HOST || !DB_PORT) {
  throw new Error('❌ Faltan variables de entorno para la conexión a la base de datos');
}

// 🚨 DIAGNÓSTICO 2: Mostrar configuración que se pasará a Sequelize
console.log('🔍 [DATABASE.JS] CONFIGURACIÓN PARA SEQUELIZE:');
console.log('   host:', DB_HOST);
console.log('   port:', parseInt(DB_PORT, 10));
console.log('   database:', DB_NAME);
console.log('   username:', DB_USER);

// === Sequelize ===
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: parseInt(DB_PORT, 10),
  dialect: 'postgres',
  logging: false,
  define: {
    timestamps: true,
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  },
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// 🚨 DIAGNÓSTICO 3: Verificar configuración ACTUAL de la instancia de Sequelize
sequelize.authenticate()
  .then(() => {
    console.log('✅ [DATABASE.JS] Conexión a PostgreSQL exitosa');
    console.log('🔍 [DATABASE.JS] CONFIGURACIÓN REAL DE SEQUELIZE:');
    console.log('   Host:', sequelize.config.host);
    console.log('   Port:', sequelize.config.port);
    console.log('   Database:', sequelize.config.database);
    console.log('   Username:', sequelize.config.username);
  })
  .catch(error => {
    console.error('❌ [DATABASE.JS] Error al autenticar con PostgreSQL:', error.message);
  });

// === pg.Pool (para queries crudas) ===
const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASS,
  port: parseInt(DB_PORT, 10),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('⚠️ [DATABASE.JS] Error en el pool de PostgreSQL:', err.message);
});

// 🚨 DIAGNÓSTICO 4: Probar conexión con pg.Pool
pool.query('SELECT NOW() as current_time')
  .then(res => {
    console.log('✅ [DATABASE.JS] Conexión con pg.Pool exitosa');
    console.log('   Hora en DB:', res.rows[0].current_time);
  })
  .catch(err => {
    console.error('❌ [DATABASE.JS] Error en conexión con pg.Pool:', err.message);
  });

// ✅ Exportar
module.exports = {
  sequelize,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};