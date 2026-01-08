// src/routes/admin.js - VERSIÓN CORREGIDA
const express = require('express');
const router = express.Router();
const { RegistrationLink, ShortLink, Client } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

// ========================
// MIDDLEWARE DE AUTENTICACIÓN
// ========================

/**
 * Middleware para verificar autenticación básica
 */
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  
  try {
    // Decodificar token base64 simple (para desarrollo)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    // Verificar expiración si existe
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    // Verificar que es usuario de FacDin
    if (!payload.email?.endsWith('@facdin.com')) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }
    
    // Agregar usuario a la request
    req.user = {
      id: payload.id,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol || 'user'
    };
    
    next();
  } catch (error) {
    console.error('Error en autenticación:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
};

 /*
  Middleware para verificar que puede generar enlaces
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  // Verificar que el email termine con los sufijos autorizados
  const email = req.user.email;
  const puedeGenerarEnlaces = 
    email.endsWith('admin@facdin.com') || 
    email.endsWith('agente@facdin.com');
  
  if (!puedeGenerarEnlaces) {
    return res.status(403).json({ 
      error: 'Acceso denegado', 
      message: 'Solo los administradores y agentes autorizados pueden generar enlaces',
      userEmail: email,
      permiso: 'solo-lectura'
    });
  }
  
  next();
};


// ========================
// RUTAS PROTEGIDAS
// ========================

// Todas las rutas requieren autenticación
router.use(requireAuth);

/**
 * Generar nuevo enlace de registro
 */
 // src/routes/admin.js
router.post('/generar-enlace', requireAdmin, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
     
    const enlace = await RegistrationLink.create({
      token,
      expiresAt,  
      used: false,
      createdBy: req.user.email
    });
    
    const link = `${req.protocol}://${req.get('host')}/register/${token}`;
    
    res.json({
      success: true,
      link,
      token,
      createdBy: req.user.email
    });
  } catch (error) {
    console.error('Error generando enlace:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

/**
 * Obtener historial de enlaces generados
 * CORRECCIÓN: Usar fechaCreacion en lugar de created_at
 */
router.get('/enlaces-generados', requireAdmin, async (req, res) => {
  try {
    const enlaces = await RegistrationLink.findAll({
      order: [['fechaCreacion', 'DESC']],  // ¡CORREGIDO! Usar fechaCreacion
      limit: 100
    });
    
    const resultado = enlaces.map(enlace => ({
      id: enlace.id,
      token: enlace.token,
      enlace: `${req.protocol}://${req.get('host')}/register/${enlace.token}`,
      usado: enlace.used,
      clienteId: enlace.clientId,
      creadoPor: enlace.createdBy,  // ¡CORREGIDO! Usar createdBy (no created_by)
      fecha: enlace.fechaCreacion,  // ¡CORREGIDO! Usar fechaCreacion
      expira: enlace.expiresAt
    }));
    
    res.json(resultado);
    
  } catch (error) {
    console.error('Error obteniendo enlaces:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ========================
// FUNCIONES DE LIMPIEZA
// ========================

/**
 * Obtener estadísticas de enlaces expirados (>24h)
 * CORRECCIÓN: Usar fechaCreacion
 */
router.get('/estadisticas-expirados', requireAdmin, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const enlacesExpirados = await RegistrationLink.count({
      where: {
        fechaCreacion: { [Op.lt]: twentyFourHoursAgo }  // ¡CORREGIDO!
      }
    });
    
    const shortlinksExpirados = await ShortLink.count({
      where: {
        fechaCreacion: { [Op.lt]: twentyFourHoursAgo }  // Ajustar según tu modelo
      }
    });
    
    res.json({
      enlacesExpirados,
      shortlinksExpirados,
      totalExpirados: enlacesExpirados + shortlinksExpirados,
      fechaConsulta: new Date().toISOString(),
      umbralHoras: 24
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas expirados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Eliminar enlaces expirados (>24h)
 * CORRECCIÓN: Usar fechaCreacion
 */
router.post('/limpiar-expirados', requireAdmin, async (req, res) => {
  let transaction;
  
  try {
    transaction = await RegistrationLink.sequelize.transaction();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Primero eliminar shortlinks expirados
    const shortlinksEliminados = await ShortLink.destroy({
      where: {
        fechaCreacion: { [Op.lt]: twentyFourHoursAgo }  // Ajustar según tu modelo
      },
      transaction
    });
    
    // Luego eliminar enlaces expirados
    const enlacesEliminados = await RegistrationLink.destroy({
      where: {
        fechaCreacion: { [Op.lt]: twentyFourHoursAgo }  // ¡CORREGIDO!
      },
      transaction
    });
    
    await transaction.commit();
    
    // Log de auditoría
    console.log(`✅ Limpieza expirados: ${enlacesEliminados} enlaces y ${shortlinksEliminados} shortlinks eliminados por ${req.user.email}`);
    
    res.json({
      success: true,
      enlacesEliminados,
      shortlinksEliminados,
      totalEliminados: enlacesEliminados + shortlinksEliminados,
      ejecutadoPor: req.user.email,
      fecha: new Date().toISOString()
    });
    
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error en limpieza expirados:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Obtener estadísticas de enlaces no usados (used = false)
 */
router.get('/estadisticas-no-usados', requireAdmin, async (req, res) => {
  try {
    const enlacesNoUsados = await RegistrationLink.count({
      where: {
        used: false
      }
    });
    
    const shortlinksNoUsados = await ShortLink.count({
      where: {
        used: false
      }
    });
    
    res.json({
      enlacesNoUsados,
      shortlinksNoUsados,
      totalNoUsados: enlacesNoUsados + shortlinksNoUsados,
      fechaConsulta: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas no usados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Eliminar enlaces no usados (used = false)
 */
router.post('/limpiar-no-usados', requireAdmin, async (req, res) => {
  let transaction;
  
  try {
    transaction = await RegistrationLink.sequelize.transaction();
    
    // Primero obtener conteo para auditoría
    const enlacesCount = await RegistrationLink.count({
      where: { used: false },
      transaction
    });
    
    const shortlinksCount = await ShortLink.count({
      where: { used: false },
      transaction
    });
    
    // Eliminar shortlinks no usados
    const shortlinksEliminados = await ShortLink.destroy({
      where: {
        used: false
      },
      transaction
    });
    
    // Eliminar enlaces no usados
    const enlacesEliminados = await RegistrationLink.destroy({
      where: {
        used: false
      },
      transaction
    });
    
    await transaction.commit();
    
    // Log de auditoría detallado
    console.log(`✅ Limpieza no usados: ${enlacesEliminados}/${enlacesCount} enlaces y ${shortlinksEliminados}/${shortlinksCount} shortlinks eliminados por ${req.user.email}`);
    
    res.json({
      success: true,
      enlacesEliminados,
      shortlinksEliminados,
      totalEliminados: enlacesEliminados + shortlinksEliminados,
      esperados: {
        enlaces: enlacesCount,
        shortlinks: shortlinksCount
      },
      ejecutadoPor: req.user.email,
      fecha: new Date().toISOString()
    });
    
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error en limpieza no usados:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      detalle: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Obtener estadísticas generales del sistema
 * CORRECCIÓN: Usar fechaCreacion
 */
router.get('/estadisticas', requireAdmin, async (req, res) => {
  try {
    const [
      totalClientes,
      totalEnlaces,
      enlacesUsados,
      enlacesNoUsados,
      shortlinksTotales,
      shortlinksUsados,
      shortlinksNoUsados
    ] = await Promise.all([
      Client.count(),
      RegistrationLink.count(),
      RegistrationLink.count({ where: { used: true } }),
      RegistrationLink.count({ where: { used: false } }),
      ShortLink.count(),
      ShortLink.count({ where: { used: true } }),
      ShortLink.count({ where: { used: false } })
    ]);
    
    // Enlaces expirados (>24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const enlacesExpirados = await RegistrationLink.count({
      where: {
        fechaCreacion: { [Op.lt]: twentyFourHoursAgo }  // ¡CORREGIDO!
      }
    });
    
    res.json({
      general: {
        clientes: totalClientes,
        enlaces: totalEnlaces,
        shortlinks: shortlinksTotales
      },
      estado: {
        enlacesUsados,
        enlacesNoUsados,
        shortlinksUsados,
        shortlinksNoUsados
      },
      expiracion: {
        enlacesExpirados,
        porcentajeExpirados: totalEnlaces > 0 ? Math.round((enlacesExpirados / totalEnlaces) * 100) : 0
      },
      porcentajes: {
        usoEnlaces: totalEnlaces > 0 ? Math.round((enlacesUsados / totalEnlaces) * 100) : 0,
        usoShortlinks: shortlinksTotales > 0 ? Math.round((shortlinksUsados / shortlinksTotales) * 100) : 0
      },
      fechaConsulta: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas generales:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Función para probar permisos (solo desarrollo)
 */
router.get('/check-permissions', requireAuth, (req, res) => {
  res.json({
    user: req.user,
    isAdmin: req.user.rol === 'admin' || req.user.email.endsWith('admin@facdin.com'),
    permissions: ['view_dashboard', 'generate_links', 'cleanup_expired', 'cleanup_unused']
  });
});

module.exports = router;
