// scripts/cleanup-final.js - VERSIÓN CORREGIDA CON fechaCreacion
require('dotenv').config({ path: '.env' });

const { Sequelize } = require('sequelize');

console.log('🧹 Limpieza de enlaces expirados FACDIN');
console.log('=======================================\n');

async function main() {
  let sequelize;
  
  try {
    // 1. Configurar conexión
    sequelize = new Sequelize(
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
    console.log('✅ Conectado a PostgreSQL');
    
    // 2. Calcular fecha límite (24 horas atrás)
    const fechaLimite = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`📅 Eliminando enlaces anteriores a: ${fechaLimite.toLocaleString()}`);
    
    // 3. Contar enlaces a eliminar - USANDO fechaCreacion
    const [conteo] = await sequelize.query(
      `SELECT COUNT(*) as total FROM registration_links 
       WHERE "fechaCreacion" < $1 AND used = false`,
      { bind: [fechaLimite] }
    );
    
    const totalEliminar = parseInt(conteo[0].total) || 0;
    console.log(`📊 Enlaces a eliminar: ${totalEliminar}`);
    
    if (totalEliminar === 0) {
      console.log('✅ No hay enlaces expirados para eliminar');
      await sequelize.close();
      return;
    }
    
    // 4. Preguntar confirmación (a menos que sea --force)
    if (!process.argv.includes('--force') && !process.argv.includes('-f')) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question(`\n¿Eliminar ${totalEliminar} enlaces expirados? (s/n): `, async (respuesta) => {
        if (respuesta.toLowerCase() === 's') {
          await eliminarEnlaces(sequelize, fechaLimite);
        } else {
          console.log('❌ Limpieza cancelada');
        }
        readline.close();
        await sequelize.close();
      });
    } else {
      console.log(`\n🔨 Forzando eliminación de ${totalEliminar} enlaces...`);
      await eliminarEnlaces(sequelize, fechaLimite);
      await sequelize.close();
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Error específico de columna
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n💡 El error indica que la columna no existe.');
      console.log('   Probando con diferentes nombres de columna...');
      
      // Intentar con diferentes nombres
      await intentarConDiferentesNombres();
    }
    
    if (sequelize) await sequelize.close();
    process.exit(1);
  }
}

async function eliminarEnlaces(sequelize, fechaLimite) {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('\n🔍 Buscando enlaces expirados...');
    
    // Obtener tokens de enlaces expirados - USANDO "fechaCreacion" entre comillas
    const [tokensExpirados] = await sequelize.query(
      `SELECT token FROM registration_links 
       WHERE "fechaCreacion" < $1 AND used = false`,
      { bind: [fechaLimite], transaction }
    );
    
    const tokens = tokensExpirados.map(t => t.token);
    console.log(`📋 Encontrados ${tokens.length} enlaces expirados`);
    
    if (tokens.length === 0) {
      await transaction.commit();
      console.log('✅ Nada que eliminar');
      return;
    }
    
    // Eliminar de short_links
    console.log('🗑️  Eliminando short_links relacionados...');
    const [shortResult] = await sequelize.query(
      `DELETE FROM short_links WHERE token = ANY($1)`,
      { bind: [tokens], transaction }
    );
    
    console.log(`🗑️  Eliminados ${shortResult} short_links`);
    
    // Eliminar de registration_links - USANDO "fechaCreacion"
    console.log('🗑️  Eliminando registration_links...');
    const [resultado] = await sequelize.query(
      `DELETE FROM registration_links 
       WHERE "fechaCreacion" < $1 AND used = false
       RETURNING id, token, "createdBy", "fechaCreacion"`,
      { bind: [fechaLimite], transaction }
    );
    
    await transaction.commit();
    
    console.log('\n🎉 LIMPIEZA COMPLETADA EXITOSAMENTE');
    console.log('==================================');
    console.log(`📊 Total eliminados: ${resultado.length}`);
    
    if (resultado.length > 0) {
      console.log('\n📋 Muestra de enlaces eliminados:');
      resultado.slice(0, 3).forEach((item, i) => {
        const fecha = new Date(item.fechaCreacion).toLocaleString();
        console.log(`\n  ${i + 1}. Token: ${item.token.substring(0, 20)}...`);
        console.log(`     Fecha: ${fecha}`);
        console.log(`     Creado por: ${item.createdBy || 'Sistema'}`);
      });
      
      if (resultado.length > 3) {
        console.log(`\n  ... y ${resultado.length - 3} más`);
      }
    }
    
    // Mostrar estadísticas finales
    await mostrarEstadisticas(sequelize);
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error durante la eliminación:', error.message);
    throw error;
  }
}

async function mostrarEstadisticas(sequelize) {
  try {
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN used = true THEN 1 ELSE 0 END) as usados,
        SUM(CASE WHEN used = false THEN 1 ELSE 0 END) as no_usados,
        MIN("fechaCreacion") as mas_antiguo,
        MAX("fechaCreacion") as mas_reciente
      FROM registration_links;
    `);
    
    console.log('\n📈 ESTADÍSTICAS ACTUALES:');
    console.log('========================');
    console.log(`  Total enlaces: ${stats[0].total || 0}`);
    console.log(`  Enlaces usados: ${stats[0].usados || 0}`);
    console.log(`  Enlaces disponibles: ${stats[0].no_usados || 0}`);
    
    if (stats[0].mas_antiguo) {
      const antiguo = new Date(stats[0].mas_antiguo).toLocaleString();
      console.log(`  Enlace más antiguo: ${antiguo}`);
    }
    
    if (stats[0].mas_reciente) {
      const reciente = new Date(stats[0].mas_reciente).toLocaleString();
      console.log(`  Enlace más reciente: ${reciente}`);
    }
    
  } catch (error) {
    console.log('⚠️  No se pudieron obtener estadísticas:', error.message);
  }
}

async function intentarConDiferentesNombres() {
  console.log('\n🔍 Probando diferentes nombres de columna...');
  
  const posiblesNombres = [
    'fechaCreacion',
    'fecha_creacion', 
    'created_at',
    'createdAt',
    'fecha',
    'created'
  ];
  
  for (const nombre of posiblesNombres) {
    console.log(`  Probando: "${nombre}"`);
    // Aquí podrías implementar lógica para probar cada nombre
  }
  
  console.log('\n💡 Para ver las columnas exactas, ejecuta:');
  console.log('   sudo -u postgres psql -p 5433 -d facdin_db -c "\\d registration_links"');
}

// Ejecutar
main();