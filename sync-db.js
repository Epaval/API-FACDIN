// sync-db.js
require('dotenv').config();
const { sequelize } = require('./src/config/database');
const db = require('./src/models');

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a BD exitosa');

    // Sincroniza TODOS los modelos
    await sequelize.sync({ alter: true });
    console.log('✅ Base de datos sincronizada');

    // Verifica que la tabla exista
    const tableExists = await sequelize.getQueryInterface().showAllTables();
    if (tableExists.includes('empleados')) {
      console.log('🟢 Tabla "empleados" creada correctamente');
    } else {
      console.log('🔴 Tabla "empleados" no fue creada');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al sincronizar:', error.message);
    process.exit(1);
  }
}

syncDatabase();