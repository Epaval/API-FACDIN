// scripts/test-db.js
require('dotenv').config({ path: '.env' });

console.log('🧪 Probando conexión a base de datos FACDIN...\n');

// Mostrar variables
console.log('🔍 Variables de entorno:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASS:', process.env.DB_PASS ? '******' : 'NO HAY');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('NODE_ENV:', process.env.NODE_ENV);

const { Sequelize } = require('sequelize');

async function test() {
  try {
    console.log('\n🔗 Intentando conectar a PostgreSQL...');
    
    const sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false
      }
    );
    
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa!');
    
    // Verificar tablas
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Tablas encontradas:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Verificar registration_links
    try {
      const [stats] = await sequelize.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN used = true THEN 1 ELSE 0 END) as usados,
          SUM(CASE WHEN used = false THEN 1 ELSE 0 END) as no_usados
        FROM registration_links;
      `);
      
      console.log('\n📈 Estadísticas de enlaces:');
      console.log(`  Total: ${stats[0].total || 0}`);
      console.log(`  Usados: ${stats[0].usados || 0}`);
      console.log(`  No usados: ${stats[0].no_usados || 0}`);
      
      // Verificar enlaces expirados (más de 24 horas)
      const [expirados] = await sequelize.query(`
        SELECT COUNT(*) as expirados
        FROM registration_links 
        WHERE fecha_creacion < NOW() - INTERVAL '24 hours'
        AND used = false;
      `);
      
      console.log(`  Expirados (>24h): ${expirados[0].expirados || 0}`);
      
    } catch (tableError) {
      console.log('⚠️  No se pudo consultar registration_links:', tableError.message);
    }
    
    await sequelize.close();
    console.log('\n🎉 Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    
    if (error.name === 'SequelizeConnectionError') {
      console.log('\n💡 Posibles soluciones:');
      console.log('1. Verificar que PostgreSQL esté corriendo:');
      console.log('   sudo systemctl status postgresql');
      console.log('2. Verificar credenciales en .env');
      console.log('3. Verificar que la base de datos exista:');
      console.log('   sudo -u postgres psql -p 5433 -c "\\l"');
      console.log('4. Verificar permisos del usuario:');
      console.log('   sudo -u postgres psql -p 5433 -c "\\du"');
    }
    
    process.exit(1);
  }
}

test();
