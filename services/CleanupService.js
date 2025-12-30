// services/CleanupService.js
const cron = require('node-cron');
const { Sequelize, Op } = require('sequelize');

class CleanupService {
  constructor() {
    // Usar la conexión existente o crear una nueva
    this.sequelize = new Sequelize(process.env.DATABASE_URL, {
      logging: false,
      dialect: 'postgres'
    });
    
    console.log('🔧 CleanupService inicializado');
  }

  async eliminarEnlacesExpirados() {
    let transaction;
    
    try {
      transaction = await this.sequelize.transaction();
      const fechaLimite = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      console.log(`🧹 Buscando enlaces expirados (anteriores a ${fechaLimite.toISOString()})...`);
      
      // PRIMERO: Buscar enlaces expirados
      const [enlacesExpirados] = await this.sequelize.query(
        `SELECT id, token FROM registration_links 
         WHERE fechaCreacion < :fechaLimite 
         AND used = false`,
        {
          replacements: { fechaLimite: fechaLimite.toISOString() },
          type: Sequelize.QueryTypes.SELECT,
          transaction
        }
      );
      
      console.log(`📊 Encontrados ${enlacesExpirados.length} enlaces expirados`);
      
      if (enlacesExpirados.length === 0) {
        await transaction.commit();
        return { eliminados: 0, mensaje: 'No hay enlaces expirados' };
      }
      
      // Preparar tokens para eliminar
      const tokens = enlacesExpirados.map(e => e.token);
      const ids = enlacesExpirados.map(e => e.id);
      
      // Eliminar de short_links
      const [shortLinksEliminados] = await this.sequelize.query(
        `DELETE FROM short_links WHERE token IN (:tokens)`,
        {
          replacements: { tokens },
          type: Sequelize.QueryTypes.DELETE,
          transaction
        }
      );
      
      console.log(`🗑️  Eliminados ${shortLinksEliminados} short_links`);
      
      // Eliminar de registration_links
      const [registrationLinksEliminados] = await this.sequelize.query(
        `DELETE FROM registration_links WHERE id IN (:ids) RETURNING id`,
        {
          replacements: { ids },
          type: Sequelize.QueryTypes.DELETE,
          transaction
        }
      );
      
      await transaction.commit();
      
      const resultado = {
        eliminados: registrationLinksEliminados.length,
        shortLinks: shortLinksEliminados,
        registrationLinks: registrationLinksEliminados.length,
        tokens: tokens
      };
      
      console.log(`✅ Limpieza completada: ${resultado.eliminados} enlaces eliminados`);
      return resultado;
      
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('❌ Error en limpieza:', error.message);
      throw error;
    }
  }

  async verificarEnlacesExpirados() {
    try {
      const fechaLimite = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const [enlacesExpirados] = await this.sequelize.query(
        `SELECT COUNT(*) as count, 
                MIN(fechaCreacion) as mas_antiguo,
                MAX(fechaCreacion) as mas_reciente
         FROM registration_links 
         WHERE fechaCreacion < :fechaLimite 
         AND used = false`,
        {
          replacements: { fechaLimite: fechaLimite.toISOString() },
          type: Sequelize.QueryTypes.SELECT
        }
      );
      
      return {
        expirados: parseInt(enlacesExpirados.count) || 0,
        masAntiguo: enlacesExpirados.mas_antiguo,
        masReciente: enlacesExpirados.mas_reciente,
        fechaLimite: fechaLimite
      };
      
    } catch (error) {
      console.error('❌ Error verificando enlaces:', error);
      throw error;
    }
  }

  iniciarProgramacion() {
    // Programar limpieza diaria a las 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      console.log(`\n⏰ [${new Date().toISOString()}] Ejecutando limpieza programada...`);
      try {
        const resultado = await this.eliminarEnlacesExpirados();
        console.log(`📋 Resultado: ${resultado.eliminados} enlaces eliminados`);
      } catch (error) {
        console.error('Error en limpieza programada:', error.message);
      }
    });
    
    console.log('✅ Limpieza programada: Diaria a las 2:00 AM');
    
    // También verificar al inicio
    this.verificarEnlacesExpirados()
      .then(info => {
        console.log(`🔍 Estado actual: ${info.expirados} enlaces expirados pendientes`);
        if (info.expirados > 0) {
          console.log(`📅 Más antiguo: ${info.masAntiguo}`);
        }
      })
      .catch(console.error);
  }
}

module.exports = CleanupService;