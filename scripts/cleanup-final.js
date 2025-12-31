// scripts/cleanup-with-logs.js
require('dotenv').config({ path: '.env' });

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Configuración de logs
const LOG_DIR = path.join(__dirname, '../logs/cleanup');
const LOG_FILE = path.join(LOG_DIR, `cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// Crear directorio de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleString('es-ES');
  const typeSymbol = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    debug: '🔍'
  }[type] || '📝';
  
  const logMessage = `[${timestamp}] ${typeSymbol} ${message}`;
  
  // Mostrar en consola
  console.log(logMessage);
  
  // Guardar en archivo
  fs.appendFileSync(LOG_FILE, logMessage + '\n', 'utf8');
  
  // También guardar en log general
  const generalLog = path.join(LOG_DIR, 'cleanup-history.log');
  fs.appendFileSync(generalLog, logMessage + '\n', 'utf8');
}

async function main() {
  log('🧹 INICIANDO LIMPIEZA DE ENLACES EXPIRADOS', 'info');
  log(`📁 Archivo de log: ${LOG_FILE}`, 'debug');
  
  let sequelize;
  
  try {
    // Configurar conexión
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: (sql) => log(`SQL: ${sql}`, 'debug')
      }
    );
    
    await sequelize.authenticate();
    log('✅ Conectado a PostgreSQL', 'success');
    
    // Calcular fecha límite
    const fechaLimite = new Date(Date.now() - 24 * 60 * 60 * 1000);
    log(`📅 Eliminando enlaces anteriores a: ${fechaLimite.toLocaleString()}`, 'info');
    
    // Contar enlaces a eliminar
    const [conteo] = await sequelize.query(
      `SELECT COUNT(*) as total FROM registration_links 
       WHERE "fechaCreacion" < $1 AND used = false`,
      { bind: [fechaLimite] }
    );
    
    const totalEliminar = parseInt(conteo[0].total) || 0;
    log(`📊 Enlaces a eliminar: ${totalEliminar}`, 'info');
    
    if (totalEliminar === 0) {
      log('✅ No hay enlaces expirados para eliminar', 'success');
      await sequelize.close();
      log('🏁 LIMPIEZA COMPLETADA - NADA QUE HACER', 'success');
      return;
    }
    
    // Ejecutar eliminación
    const resultado = await eliminarEnlaces(sequelize, fechaLimite);
    
    // Guardar reporte detallado
    guardarReporte(resultado, fechaLimite);
    
    await sequelize.close();
    log('🏁 LIMPIEZA COMPLETADA EXITOSAMENTE', 'success');
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'error');
    log(`Stack: ${error.stack}`, 'debug');
    
    if (sequelize) await sequelize.close();
    process.exit(1);
  }
}

async function eliminarEnlaces(sequelize, fechaLimite) {
  const transaction = await sequelize.transaction();
  
  try {
    log('🔍 Buscando enlaces expirados...', 'info');
    
    // 1. Obtener enlaces antes de eliminar (para el log)
    const [enlacesExpirados] = await sequelize.query(
      `SELECT id, token, "createdBy", "fechaCreacion" 
       FROM registration_links 
       WHERE "fechaCreacion" < $1 AND used = false
       ORDER BY "fechaCreacion"`,
      { bind: [fechaLimite], transaction }
    );
    
    log(`📋 Encontrados ${enlacesExpirados.length} enlaces expirados`, 'info');
    
    if (enlacesExpirados.length === 0) {
      await transaction.commit();
      return { eliminados: 0, detalles: [] };
    }
    
    // 2. Guardar detalles para el log
    const tokens = enlacesExpirados.map(t => t.token);
    const detalles = enlacesExpirados.map(e => ({
      id: e.id,
      token: e.token,
      creadoPor: e.createdBy,
      fecha: e.fechaCreacion
    }));
    
    // 3. Eliminar short_links
    log('🗑️  Eliminando short_links relacionados...', 'info');
    const [shortResult] = await sequelize.query(
      `DELETE FROM short_links WHERE token = ANY($1) RETURNING id, token`,
      { bind: [tokens], transaction }
    );
    
    log(`🗑️  Eliminados ${shortResult.length} short_links`, 'success');
    
    // 4. Eliminar registration_links
    log('🗑️  Eliminando registration_links...', 'info');
    const [regResult] = await sequelize.query(
      `DELETE FROM registration_links WHERE token = ANY($1) RETURNING id, token`,
      { bind: [tokens], transaction }
    );
    
    await transaction.commit();
    
    log(`✅ Eliminados ${regResult.length} registration_links`, 'success');
    
    return {
      eliminados: regResult.length,
      shortLinksEliminados: shortResult.length,
      detalles: detalles,
      fechaLimpieza: new Date(),
      fechaLimite: fechaLimite
    };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function guardarReporte(resultado, fechaLimite) {
  const reportDir = path.join(__dirname, '../logs/reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportFile = path.join(reportDir, `reporte-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  
  const reporte = {
    metadata: {
      fechaLimpieza: new Date().toISOString(),
      fechaLimite: fechaLimite.toISOString(),
      sistema: 'FACDIN Cleanup',
      version: '1.0.0'
    },
    resumen: {
      totalEliminados: resultado.eliminados,
      shortLinksEliminados: resultado.shortLinksEliminados,
      duracionEstimada: 'Menos de 1 minuto'
    },
    detalles: resultado.detalles,
    estadisticas: {
      porUsuario: resultado.detalles.reduce((acc, item) => {
        acc[item.creadoPor] = (acc[item.creadoPor] || 0) + 1;
        return acc;
      }, {})
    }
  };
  
  fs.writeFileSync(reportFile, JSON.stringify(reporte, null, 2), 'utf8');
  log(`📄 Reporte guardado en: ${reportFile}`, 'success');
  
  // También guardar resumen en CSV
  guardarResumenCSV(resultado, fechaLimite);
}

function guardarResumenCSV(resultado, fechaLimite) {
  const csvDir = path.join(__dirname, '../logs/csv');
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }
  
  const csvFile = path.join(csvDir, `resumen-${new Date().toISOString().split('T')[0]}.csv`);
  
  let csvContent = 'ID,Token,CreadoPor,Fecha,Estado\n';
  
  resultado.detalles.forEach(item => {
    const fecha = new Date(item.fecha).toLocaleString('es-ES');
    csvContent += `${item.id},"${item.token}","${item.creadoPor}","${fecha}",ELIMINADO\n`;
  });
  
  // Agregar resumen al final
  csvContent += `\nRESUMEN,,,,\n`;
  csvContent += `Total eliminados,${resultado.eliminados},,,\n`;
  csvContent += `Fecha límite,"${fechaLimite.toLocaleString('es-ES')}",,,\n`;
  csvContent += `Fecha limpieza,"${new Date().toLocaleString('es-ES')}",,,\n`;
  
  fs.writeFileSync(csvFile, csvContent, 'utf8');
  log(`📊 Resumen CSV guardado en: ${csvFile}`, 'success');
}

// Ejecutar
const forceMode = process.argv.includes('--force') || process.argv.includes('-f');
if (forceMode) {
  log('🔨 MODO FORZADO ACTIVADO', 'warning');
  main();
} else {
  log('❌ Ejecuta con --force para confirmar', 'error');
  process.exit(1);
}
