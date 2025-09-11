// sync-db.js
require('dotenv').config();
const { sequelize } = require('./src/config/database');
const db = require('./src/models'); // Carga todos los modelos

async function syncDB() {
  try {
    console.log('🔍 Intentando conectar a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL exitosa');

    // 🔥 Usa { alter: true } para ajustar columnas existentes
    await sequelize.sync({ alter: true });

    // ✅ Verifica que la tabla tenga el campo `token`
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'registration_links'
    `);

    const columnNames = columns.map(col => col.column_name);
    console.log('📋 Columnas en registration_links:', columnNames);

    if (!columnNames.includes('token')) {
      console.error('❌ ERROR: La columna "token" NO existe en la tabla "registration_links"');
      console.log('💡 Solución: Asegúrate de que RegistrationLink.js esté bien definido y vuelve a ejecutar este script.');
      process.exit(1);
    }

    console.log('✅ Tabla registration_links verificada correctamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error detallado:', error.message);
    if (error.parent) console.error('📝 Error SQL:', error.parent.message);
    process.exit(1);
  }
}

syncDB();