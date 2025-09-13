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
  const { nombre, ficha, ci, rol, password, email } = req.body;

  // Campos obligatorios
  if (!nombre || !ficha || !ci || !rol || !password) {
    return res.status(400).json({ 
      error: 'Nombre, ficha, CI, rol y contraseña son obligatorios' 
    });
  }

  const ROLES = ['asesor', 'ga', 'gae'];
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ 
      error: 'Rol no válido. Usa: asesor, ga, gae' 
    });
  }

  try {
    const client = await Client.findOne({ where: { apiKey } });
    if (!client) {
      return res.status(403).json({ error: 'API Key inválida o no autorizada' });
    }

    const schema = `cliente_${client.id}`;

    // Verificar si ya existen ficha o CI
    const resultCheck = await sequelize.query(
      `SELECT id, ficha, ci FROM "${schema}"."usuarios_autorizados" WHERE ficha = :ficha OR ci = :ci`,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { ficha, ci }
      }
    );

    if (Array.isArray(resultCheck) && resultCheck.length > 0) {
      const conflict = resultCheck[0];
      if (conflict.ficha === ficha) {
        return res.status(409).json({ error: `Ya existe un usuario con la ficha ${ficha}` });
      }
      if (conflict.ci === ci) {
        return res.status(409).json({ error: `Ya existe un usuario con la CI ${ci}` });
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insertar nuevo usuario
    const [insertedUser] = await sequelize.query(
      `INSERT INTO "${schema}"."usuarios_autorizados"
       (nombre, ficha, ci, rol, password_hash, email)
       VALUES (:nombre, :ficha, :ci, :rol, :passwordHash, :email)
       RETURNING id, nombre, ficha, ci, rol, email`,
      {
        type: sequelize.QueryTypes.RAW,
        replacements: { nombre, ficha, ci, rol, passwordHash, email: email || null },
        plain: true
      }
    );

    if (!insertedUser || !insertedUser.id) {
      throw new Error('No se generó ID del usuario');
    }

    const userAgent = req.get('User-Agent') || req.headers['user-agent'] || 'desconocido';

    // Registrar evento
    await sequelize.query(
      `INSERT INTO "${schema}"."registro_eventos"
       (accion, entidad, entidad_id, detalle, usuario, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          'crear_usuario',
          'usuario',
          insertedUser.id,
          `Usuario ${ficha} (CI: ${ci}) creado como ${rol}`,
          ficha,
          req.ip || '127.0.0.1',
          userAgent.substring(0, 255)
        ]
      }
    );

    res.json({
      message: '✅ Usuario registrado exitosamente',
      usuario: {
        id: insertedUser.id,
        nombre: insertedUser.nombre,
        ficha: insertedUser.ficha,
        ci: insertedUser.ci,
        rol: insertedUser.rol,
        email: insertedUser.email
      }
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: `Ya existe un usuario con esta ficha o CI`
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
  const { ficha, password } = req.body; // ← Ahora es ficha, no email
  const apiKey = req.headers['x-api-key'];

  if (!ficha || !password || !apiKey) {
    return res.status(400).json({ 
      error: 'Ficha, contraseña y API Key son obligatorios' 
    });
  }

  try {
    const client = await Client.findOne({ where: { apiKey } });
    if (!client) {
      return res.status(403).json({ error: 'API Key inválida' });
    }

    const schema = `cliente_${client.id}`;

    const result = await sequelize.query(
      `SELECT id, nombre, ficha, ci, rol, activo, password_hash, email
       FROM "${schema}"."usuarios_autorizados" 
       WHERE ficha = :ficha`,
      {
        type: sequelize.QueryTypes.SELECT,
        replacements: { ficha }
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
      console.error('❌ Hash inválido o dañado para:', ficha);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // ✅ Generar JWT con ficha y CI
    const token = jwt.sign(
      { 
        id: user.id, 
        ficha: user.ficha, 
        ci: user.ci, 
        rol: user.rol, 
        clientId: client.id 
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Guardar en Redis
    await redis.set(`session:${user.id}`, JSON.stringify({
      token,
      rol: user.rol,
      clientId: client.id,
      ficha: user.ficha,
      ci: user.ci,
      loggedInAt: new Date().toISOString(),
      ip: req.ip
    }), { EX: 8 * 60 * 60 });

    res.json({
      message: '✅ Autenticado correctamente',
      token,
      usuario: { 
        nombre: user.nombre, 
        rol: user.rol, 
        ficha: user.ficha, 
        ci: user.ci,
        email: user.email 
      }
    });

  } catch (error) {
    console.error('🔴 Error crítico en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};