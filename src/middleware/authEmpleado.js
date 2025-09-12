// src/middleware/authEmpleado.js
const { Empleado } = require('../models');

exports.autorizarEmpleado = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token requerido.' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Simulación simple: el token es el email codificado
    const buffer = Buffer.from(token, 'base64');
    const email = buffer.toString('utf-8');

    const empleado = await Empleado.findOne({
      where: { email, activo: true }
    });

    if (!empleado) {
      return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
    }

    req.empleado = empleado; 
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar el empleado' });
  }
};