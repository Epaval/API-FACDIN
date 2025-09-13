// src/middleware/authJwt.js
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;

exports.verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.empleadoId = decoded.id;
    req.email = decoded.email;
    req.rol = decoded.rol;
    req.clientId = decoded.clientId;

    // ✅ Opcional: agregar objeto completo
    req.empleado = {
      id: decoded.id,
      email: decoded.email,
      rol: decoded.rol,
      clientId: decoded.clientId
    };

    // Verificar sesión en Redis
    const session = await redis.get(`session:${decoded.id}`);
    if (!session) {
      return res.status(403).json({ error: 'Sesión no válida o expirada.' });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};