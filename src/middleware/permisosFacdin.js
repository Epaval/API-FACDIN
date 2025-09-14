const jwt = require('jsonwebtoken');
const redis = require('../config/redis');

// src/middleware/permisosFacdin.js
const PERMISOS = {
  agente: [
    'ver_dashboard',
    'generar_enlace',
    'ver_logs',
    'enviar_correo'
  ],
  admin: [
    'ver_dashboard',
    'generar_enlace',
    'ver_logs',
    'enviar_correo',
    'gestionar_empleados',
    'editar_configuracion',
    'acceso_total_db'
  ]
};

/**
 * Middleware: verifica si el empleado tiene un permiso específico
 */
exports.tienePermisoFacdin = (permisoRequerido) => {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    try {
      // Verificar JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.empleado = decoded; // Guardar en request

      // Opcional: Validar sesión activa en Redis
      const sessionData = await redis.get(`session:${decoded.id}`);
      if (!sessionData) {
        return res.status(401).json({ error: 'Sesión expirada o inválida' });
      }

      const { rol } = decoded;

      if (!rol) {
        return res.status(403).json({ error: 'Acceso denegado: rol no definido' });
      }

      const permisos = PERMISOS[rol];
      if (!permisos) {
        return res.status(403).json({ error: 'Rol no autorizado' });
      }

      if (!permisos.includes(permisoRequerido)) {
        return res.status(403).json({
          error: `Acceso denegado: el rol '${rol}' no tiene permiso '${permisoRequerido}'`
        });
      }

      next();

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token inválido' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      console.error('Error en tienePermisoFacdin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
};

module.exports = { ...module.exports, PERMISOS };