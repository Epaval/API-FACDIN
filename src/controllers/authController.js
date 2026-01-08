// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Empleado } = require('../models');
const redis = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Iniciar sesión como empleado de FacDin
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const empleado = await Empleado.findOne({ where: { email } });

    if (!empleado || !empleado.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, empleado.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // ✅ Generar JWT
    const token = jwt.sign(
      { id: empleado.id, email: empleado.email, rol: empleado.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // ✅ Guardar sesión activa en Redis
    await redis.set(`session:${empleado.id}`, JSON.stringify({
      token,
      loggedInAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }), { EX: 8 * 60 * 60 }); // 8 horas

    res.json({
      message: '✅ Autenticación exitosa',
      token,
      empleado: {
        nombre: empleado.nombre,
        email: empleado.email,
        rol: empleado.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/**
 * Cerrar sesión
 */
exports.logout = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      await redis.del(`session:${decoded.id}`);
      await redis.del(`caja:${decoded.id}`); // Opcional: cerrar caja
    } catch (error) {
      // Token ya expiró o es inválido
    }
  }

  res.json({ message: '✅ Sesión cerrada correctamente' });
}; 