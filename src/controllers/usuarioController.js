// src/controllers/usuarioController.js
const { Client } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const { sequelize } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Registra un nuevo usuario autorizado (cajero, supervisor, admin)
 */
exports.registrarUsuario = async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const { nombre, email, rol, password } = req.body;

  if (!nombre || !email || !rol || !password) {
    return res.status(400).json({ 
      error: 'Nombre, email, rol y contraseña son obligatorios' 
    });
  }

  const ROLES = ['cajero', 'supervisor', 'admin'];
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ 
      error: 'Rol no válido. Usa: cajero, supervisor, admin' 
    });
  }

  try {
    const client = await Client.findOne({ where: { apiKey } });
    if (!client) {
      return res.status(403).json({ error: 'API Key inválida o no autorizada' });
    }

    const schema = `cliente_${client.id}`;

    const result = await sequelize.query(
      `SELECT id FROM "${schema}"."usuarios_autorizados" WHERE email = :email`,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { email }
      }
    );

    if (Array.isArray(result) && result.length > 0) {
      return res.status(409).json({
        error: `Ya existe un usuario con el correo ${email}`
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const insertResult = await sequelize.query(
      `INSERT INTO "${schema}"."usuarios_autorizados"
       (nombre, email, rol, password_hash)
       VALUES (:nombre, :email, :rol, :passwordHash)
       RETURNING id, nombre, email, rol`,
      {
        type: sequelize.QueryTypes.INSERT,
        replacements: { nombre, email, rol, passwordHash }
      }
    );

    const usuario = Array.isArray(insertResult) && insertResult.length > 0 ? insertResult[0] : null;

    if (!usuario) {
      throw new Error('No se pudo crear el usuario');
    }

    const userAgent = req.get('User-Agent') || req.headers['user-agent'] || 'desconocido';

    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos"
       (accion, entidad, entidad_id, detalle, usuario, ip, user_agent)
       VALUES (:accion, :entidad, :entidad_id, :detalle, :usuario, :ip, :user_agent)`,
      {
        replacements: {
          accion: 'crear_usuario',
          entidad: 'usuario',
          entidad_id: usuario.id,
          detalle: `Usuario ${email} creado como ${rol}`,
          usuario: email,
          ip: req.ip || '127.0.0.1',
          user_agent: userAgent.substring(0, 255)
        }
      }
    );

    res.json({
      message: '✅ Usuario registrado exitosamente',
      usuario
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: `Ya existe un usuario con el correo ${email}`
      });
    }
    res.status(500).json({ 
      error: 'No se pudo registrar el usuario. Intente más tarde.' 
    });
  }
};

/**
 * Inicia sesión un usuario autorizado del cliente
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const apiKey = req.headers['x-api-key'];

  if (!email || !password || !apiKey) {
    return res.status(400).json({ 
      error: 'Email, contraseña y API Key son obligatorios' 
    });
  }

  try {
    const client = await Client.findOne({ where: { apiKey } });
    if (!client) {
      return res.status(403).json({ error: 'API Key inválida' });
    }

    const schema = `cliente_${client.id}`;

    const result = await sequelize.query(
      `SELECT id, nombre, email, rol, activo, password_hash 
       FROM "${schema}"."usuarios_autorizados" 
       WHERE email = :email`,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { email }
      }
    );

    if (!Array.isArray(result) || result.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result[0];

    if (!user.activo) {
      return res.status(401).json({ error: 'Cuenta inactiva' });
    }

    if (!user.password_hash || typeof user.password_hash !== 'string' || user.password_hash.length !== 60) {
      console.error('❌ Hash inválido o dañado para:', email);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, clientId: client.id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await redis.set(`session:${user.id}`, JSON.stringify({
      token,
      rol: user.rol,
      clientId: client.id,
      loggedInAt: new Date().toISOString(),
      ip: req.ip
    }), { EX: 8 * 60 * 60 });

    res.json({
      message: '✅ Autenticado correctamente',
      token,
      usuario: { nombre: user.nombre, rol: user.rol, email: user.email }
    });

  } catch (error) {
    console.error('🔴 Error crítico en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};