// services/linkService.js
const crypto = require('crypto');
const RegistrationLink = require('../models/RegistrationLink');

async function generarLinkRegistro(adminEmail) {
  const token = crypto.randomBytes(32).toString('hex'); // Token único
  const link = `https://app.facdin.com/register/${token}`;

  const nuevoLink = await RegistrationLink.create({
    token,
    used: false,
    createdBy: adminEmail
  });

  return link; // Enviar por correo
}