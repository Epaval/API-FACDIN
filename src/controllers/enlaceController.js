// src/controllers/enlaceController.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Client = require('../models').Client;
const RegistrationLink = require('../models').RegistrationLink;
const ShortLink = require('../models').ShortLink;

// Usa nodemailer para enviar correos
const nodemailer = require('nodemailer');

// Transporte de correo (configura con tus credenciales)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// HTML del formulario
const formHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>🔐 Generar Enlace - FACDIN Admin</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #f0f2f5;
      margin: 0;
      padding: 40px;
      text-align: center;
    }
    .container {
      max-width: 600px;
      margin: auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1 { color: #1877f2; }
    label {
      display: block;
      text-align: left;
      margin: 20px 0 8px;
      font-weight: 600;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 16px;
    }
    button {
      background: #1877f2;
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 20px;
    }
    button:hover { background: #166fe5; }
    .result {
      margin-top: 30px;
      padding: 16px;
      background: #e7f3ff;
      border: 1px solid #b3d9ff;
      border-radius: 6px;
      font-family: monospace;
      word-break: break-all;
    }
    .copy-btn {
      background: #28a745;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Generar Enlace de Registro</h1>
    <p>Genera un enlace seguro para nuevos clientes.</p>

    <form method="POST">
      <label>Nombre del Cliente *</label>
      <input type="text" name="nombre" required />

      <label>Email del Cliente *</label>
      <input type="email" name="email" required />

      <button type="submit">Generar y Enviar Enlace</button>
    </form>

    {{#if link}}
    <div class="result">
      <strong>Enlace generado:</strong>
      <div id="enlace">{{link}}</div>
      <button class="copy-btn" onclick="copiar()">📋 Copiar al portapapeles</button>
    </div>
    {{/if}}

    <script>
      function copiar() {
        const enlace = document.getElementById('enlace').innerText;
        navigator.clipboard.writeText(enlace).then(() => {
          alert('✅ Enlace copiado al portapapeles');
        });
      }
    </script>
  </div>
</body>
</html>
`;

// Muestra el formulario
exports.mostrarFormularioEnlace = (req, res) => {
  res.send(formHTML.replace('{{#if link}}', '').replace('{{/if}}', ''));
};

// Genera y envía el enlace
exports.generarYEnviarEnlace = async (req, res) => {
  const { nombre, email } = req.body;

  if (!nombre || !email) {
    return res.status(400).send('Todos los campos son obligatorios.');
  }

  const transaction = await Client.sequelize.transaction();

  try {
    // 1. Generar token único
    const token = crypto.randomBytes(32).toString('hex');

    // 2. Crear registration_link
    await RegistrationLink.create({
      token,
      used: false,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutos
      createdBy: req.email || 'admin@facdin.com'
    }, { transaction });

    // 3. Generar short_id
    const short_id = crypto.randomBytes(4).toString('hex').substring(0, 8); // Ej: a7b2x9k1
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
    const enlaceAcortado = `${baseUrl}/r/${short_id}`;

    // 4. Guardar en short_links
    await ShortLink.create({
      short_id,
      token,
      expires_at: new Date(Date.now() + 3 * 60 * 1000)
    }, { transaction });

    await transaction.commit();

    // 5. Enviar correo
    const mailOptions = {
      from: `"FacDin API" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔑 Activa tu acceso a FacDin API',
      html: `
        <h2>Hola ${nombre},</h2>
        <p>Gracias por afiliarte a FacDin API. Haz clic en el enlace para completar tu registro:</p>
        <p><a href="${enlaceAcortado}" target="_blank">${enlaceAcortado}</a></p>
        <p>Este enlace expira en 3 minutos.</p>
        <p>Saludos,<br>El equipo de FacDin</p>
      `
    };

    await transporter.sendMail(mailOptions);

    // 6. Mostrar resultado
    const htmlConEnlace = formHTML
      .replace('{{#if link}}', '<!--if-->')
      .replace('{{/if}}', '<!--endif-->')
      .replace('{{link}}', enlaceAcortado);

    res.send(htmlConEnlace);

  } catch (error) {
    await transaction.rollback();
    console.error('Error:', error);
    res.status(500).send('No se pudo generar el enlace.');
  }
};