// src/routes/admin.js
const express = require('express');
const router = express.Router();
const path = require('path');

// Middlewares
const { verifyToken } = require('../middleware/authJwt'); // Verifica JWT
const { tienePermisoFacdin } = require('../middleware/permisosFacdin'); // Permisos FACDIN-API

// Modelos
const db = require('../models');
const RegistrationLink = db.RegistrationLink;
const ShortLink = db.ShortLink;

// 🔐 Protección 1: Verificar autenticación JWT
router.use(verifyToken);

// 🔐 Protección 2: Validar que sea empleado de FACDIN-API (@facdin.com)
router.use((req, res, next) => {
  const { email } = req.empleado || {};

  if (!email || !email.endsWith('@facdin.com')) {
    return res.status(403).json({
      error: 'Acceso denegado: solo empleados de FACDIN-API pueden acceder'
    });
  }

  next();
});

// 🔐 Protección 3: Verificar permiso específico
// Este endpoint requiere el permiso 'generar_enlace'
router.use(tienePermisoFacdin('generar_enlace'));

// === RUTAS PROTEGIDAS ===

// GET /api/admin/dashboard → Sirve el HTML del panel
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../views/dashboard.html'));
});

// POST /api/admin/generar-enlace → Genera un enlace único de registro
router.post('/generar-enlace', async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const shortId = crypto.randomBytes(4).toString('hex').substring(0, 8);

    // Crear enlace de registro
    await RegistrationLink.create({
      token,
      used: false,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutos
      createdBy: req.empleado.email
    }, { transaction });

    // Crear enlace acortado
    await ShortLink.create({
      short_id: shortId,
      token,
      expires_at: new Date(Date.now() + 3 * 60 * 1000),
      created_by: req.empleado.email
    }, { transaction });

    await transaction.commit();

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
    const enlaceAcortado = `${baseUrl}/r/${shortId}`;

    res.json({ link: enlaceAcortado });

  } catch (error) {
    await transaction.rollback();
    console.error('Error generando enlace:', error);
    res.status(500).json({ error: 'No se pudo generar el enlace' });
  }
});

router.get('/enlaces-generados', async (req, res) => {
  try {
    const RegistrationLink = db.RegistrationLink;

    // Obtener los enlaces ordenados del más reciente al más antiguo
    const enlaces = await RegistrationLink.findAll({
      order: [['fechaCreacion', 'DESC']],
      limit: 50
    });

    // Transformar los datos para el frontend
      const datosFormateados = enlaces.map(enlace => {
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
      return {
        id: enlace.id,
        token: enlace.token,
        enlace: `${baseUrl}/r/${enlace.token}`, 
        cliente: enlace.clientId,
        usado: enlace.used,
        creadoPor: enlace.createdBy,
        fecha: enlace.fechaCreacion
      };
    });

    res.json(datosFormateados);

  } catch (error) {
    console.error('Error al cargar enlaces:', error);
    res.status(500).json({ error: 'No se pudo cargar el historial de enlaces' });
  }
});

module.exports = router;