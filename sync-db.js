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
    if (tableExists.includes('registration_links')) {
      console.log('🟢 Tabla "registration_links" creada correctamente');
    } else {
      console.log('🔴 Tabla "registration_links" no fue creada');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al sincronizar:', error.message);
    process.exit(1);
  }
}

syncDatabase();