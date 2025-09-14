// src/routes/redirect.js
const express = require('express');
const router = express.Router();
const db = require('../models');

const ShortLink = db.ShortLink;

router.get('/r/:short_id', async (req, res) => {
  const { short_id } = req.params;

  try {
    const record = await ShortLink.findOne({ where: { short_id } });

    if (!record) {
      return res.status(404).send('<h1>🔗 Enlace no válido</h1>');
    }

    if (new Date() > record.expires_at) {
      return res.status(400).send('<h1>⏰ Expirado</h1>');
    }

    // Opcional: marcar como usado
    // await record.update({ used: true });

    // Redirigir al formulario real
    res.redirect(`/api/register/${record.token}`);

  } catch (error) {
    console.error('Error en /r/:', error);
    res.status(500).send('<h1>❌ Error interno</h1>');
  }
});

module.exports = router;