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
 * Middleware básico de autenticación (solo verifica token)
 */
exports.autenticarFacdin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
  }

  try {
    // Verificar JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.empleado = decoded; // Guardar en request

    // Opcional: Validar sesión activa en Redis (si está configurado)
    if (redis) {
      const sessionData = await redis.get(`session:${decoded.id}`);
      if (!sessionData) {
        return res.status(401).json({ error: 'Sesión expirada o inválida' });
      }
    }

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    console.error('Error en autenticarFacdin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
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
      req.empleado = decoded;

      // Validar Redis si existe
      if (redis) {
        const sessionData = await redis.get(`session:${decoded.id}`);
        if (!sessionData) {
          return res.status(401).json({ error: 'Sesión expirada o inválida' });
        }
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

/**
 * Middleware: verifica si el empleado tiene un rol específico
 */
exports.esRolFacdin = (rolesPermitidos) => {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.empleado = decoded;

      if (redis) {
        const sessionData = await redis.get(`session:${decoded.id}`);
        if (!sessionData) {
          return res.status(401).json({ error: 'Sesión expirada o inválida' });
        }
      }

      const { rol } = decoded;

      if (!rol) {
        return res.status(403).json({ error: 'Acceso denegado: rol no definido' });
      }

      if (!rolesPermitidos.includes(rol)) {
        return res.status(403).json({
          error: `Acceso denegado: el rol '${rol}' no está autorizado`
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
      console.error('Error en esRolFacdin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  };
};

// Función para generar token (útil para login)
exports.generarTokenFacdin = (empleadoData) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no está configurado');
  }

  return jwt.sign(
    {
      id: empleadoData.id,
      email: empleadoData.email,
      nombre: empleadoData.nombre,
      rol: empleadoData.rol,
      exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 horas
    },
    process.env.JWT_SECRET
  );
};

module.exports = { ...exports, PERMISOS };
