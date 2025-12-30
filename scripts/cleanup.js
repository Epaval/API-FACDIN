// scripts/cleanup.js
require('dotenv').config({ path: '.env' });

async function main() {
  console.log('🚀 Iniciando servicio de limpieza FACDIN');
  console.log('=======================================\n');
  
  try {
    // Importar después de cargar dotenv
    const CleanupService = require('../services/CleanupService');
    const cleanupService = new CleanupService();
    
    // Verificar estado primero
    console.log('🔍 Verificando estado de enlaces...');
    const estado = await cleanupService.verificarEnlacesExpirados();
    
    console.log(`📊 Enlaces expirados pendientes: ${estado.expirados}`);
    console.log(`📅 Fecha límite: ${estado.fechaLimite.toLocaleString()}`);
    
    if (estado.expirados > 0) {
      console.log(`📅 Más antiguo: ${estado.masAntiguo}`);
      console.log(`📅 Más reciente: ${estado.masReciente}`);
      
      // Preguntar si eliminar
      if (process.argv.includes('--force') || process.argv.includes('-f')) {
        console.log('\n🧹 Forzando limpieza...');
        await ejecutarLimpieza(cleanupService);
      } else {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        readline.question(`\n¿Eliminar ${estado.expirados} enlaces expirados? (s/n): `, async (respuesta) => {
          if (respuesta.toLowerCase() === 's') {
            await ejecutarLimpieza(cleanupService);
          } else {
            console.log('❌ Limpieza cancelada');
          }
          readline.close();
          process.exit(0);
        });
        
        return; // Salir aquí para esperar respuesta
      }
    } else {
      console.log('✅ No hay enlaces expirados para limpiar');
    }
    
    // Si se especificó --schedule, iniciar programación
    if (process.argv.includes('--schedule') || process.argv.includes('-s')) {
      console.log('\n⏰ Iniciando programación automática...');
      cleanupService.iniciarProgramacion();
      
      // Mantener proceso activo
      process.on('SIGINT', () => {
        console.log('\n👋 Deteniendo servicio de limpieza...');
        process.exit(0);
      });
      
      console.log('✅ Servicio ejecutándose. Presiona Ctrl+C para salir.');
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

async function ejecutarLimpieza(cleanupService) {
  try {
    console.log('\n🧹 Ejecutando limpieza...');
    const resultado = await cleanupService.eliminarEnlacesExpirados();
    
    console.log('\n✅ LIMPIEZA COMPLETADA');
    console.log('=====================');
    console.log(`📊 Enlaces eliminados: ${resultado.eliminados}`);
    console.log(`🔗 Short links eliminados: ${resultado.shortLinks}`);
    console.log(`📝 Registration links eliminados: ${resultado.registrationLinks}`);
    
    if (resultado.tokens && resultado.tokens.length > 0) {
      console.log('\n🗑️  Tokens eliminados:');
      resultado.tokens.forEach((token, i) => {
        console.log(`  ${i + 1}. ${token.substring(0, 20)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main();