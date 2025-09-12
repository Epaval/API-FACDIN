// src/controllers/registerController.js
const { Client } = require("../models");
const { RegistrationLink } = require("../models");
const { validateRif } = require("../utils/validateRif");
const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcrypt");
const ClientSchemaService = require('../services/clientSchemaService');

/**
 * Genera una API Key única para el cliente
 * @returns {string}
 */
const generateApiKey = () => {
  const prefix = process.env.API_KEY_PREFIX || "fcd_";
  return `${prefix}${crypto.randomBytes(24).toString("hex")}`;
};

/**
 * Muestra el formulario de registro si el link es válido
 */
// src/controllers/registerController.js
exports.mostrarFormulario = async (req, res) => {
  
  const { token } = req.params;
   

  try {
    const link = await RegistrationLink.findOne({ where: { token } });
   

    if (!link) {
      return res.status(404).send('<h1>🔗 Link no válido</h1><p>El enlace de registro no existe.</p>');
    }

    // ✅ Extraer datos pre-cargados
    const { name, rif } = link.meta || {};

    if (link.used) {
      return res.send('<h1>🚫 Este link ya fue usado</h1><p>Este enlace solo puede usarse una vez.</p>');
    }

    const ahora = new Date();
    if (ahora > link.expiresAt) {
      return res.send('<h1>⏰ Este link ha expirado</h1><p>Solicita un nuevo enlace de registro.</p>');
    }

    const expiresAtISO = link.expiresAt.toISOString();

    // ✅ Inyectar name y rif en el HTML
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Regístrate en FacDin</title>
  <style>
    :root {
      --primary: #007bff;
      --primary-dark: #0056b3;
      --gray: #6c757d;
      --light: #f8f9fa;
      --danger: #dc3545;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
      margin: 0;
      padding: 40px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      max-width: 500px;
      width: 100%;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      text-align: center;
    }
    .header {
      background: var(--primary);
      color: white;
      padding: 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .timer {
      font-size: 18px;
      font-weight: bold;
      color: white;
      margin-top: 8px;
    }
    .content {
      padding: 30px;
    }
    input {
      width: 100%;
      padding: 14px 16px;
      margin: 12px 0;
      border: 1px solid #ced4da;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    }
    input[readonly] {
      background: #f4f4f4;
      color: #aaa;
      cursor: not-allowed;
    }
    button {
      background: var(--primary);
      color: white;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 10px;
      width: 100%;
      font-weight: 600;
      transition: background 0.3s;
    }
    button:hover:not(:disabled) {
      background: var(--primary-dark);
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .footer {
      padding: 20px;
      background: #f8f9fa;
      color: var(--gray);
      font-size: 14px;
      border-top: 1px solid #dee2e6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Bienvenido a FacDin</h1>
      <div class="timer" id="countdown">⏳ Tiempo restante: <span id="time">Cargando...</span></div>
    </div>
    <div class="content">
      <p>Completa tus datos para activar tu acceso a la API.</p>
      <form id="registroForm">

        <!-- Nombre de la empresa -->
        <input type="text" name="name" placeholder="Nombre de la empresa" oninput="this.value = this.value.toUpperCase();" />

        <!-- RIF -->
        <input  type="text" name="rif"  placeholder="RIF (J123456789)" 
        oninput="this.value = this.value.toUpperCase();" maxlength="10"
        required />

        <!-- Contraseña -->
        <input type="password" name="password" placeholder="Contraseña" autocomplete="new-password" required />

        <!-- Repetir contraseña -->
        <input type="password" name="repetirPassword" placeholder="Repetir contraseña" autocomplete="new-password" required />

        <button type="submit">Activar Acceso</button>
      </form>
    </div>
    <div class="footer">
      <p>FacDin - Facturación Digital Inteligente</p>
    </div>
  </div>

  <script>
    // Fecha de expiración desde el backend
    const expiresAt = new Date("${expiresAtISO}").getTime();

    function actualizarReloj() {
      const ahora = new Date().getTime();
      const diferencia = expiresAt - ahora;

      if (diferencia <= 0) {
        document.getElementById('time').textContent = 'Expirado';
        document.getElementById('countdown').classList.add('expired');
        document.querySelectorAll('input, button').forEach(el => el.disabled = true);
        return;
      }

      const minutos = Math.floor(diferencia / (1000 * 60));
      const segundos = Math.floor((diferencia / 1000) % 60);
      document.getElementById('time').textContent = \`\${minutos}m \${segundos}s\`;
    }

    actualizarReloj();
    setInterval(actualizarReloj, 1000);

    // Validación al enviar
    document.getElementById('registroForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      const ahora = new Date().getTime();
      if (ahora > expiresAt) {
        alert('❌ El tiempo de registro ha expirado.');
        return;
      }

      if (data.password !== data.repetirPassword) {
        alert('❌ Las contraseñas no coinciden.');
        return;
      }

      if (data.password.length < 6) {
        alert('❌ La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      const response = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        window.location.href = '/api/register/success?key=' + encodeURIComponent(result.apiKey);
      } else {
        const error = await response.json();
        alert('Error: ' + (error.error || 'No se pudo registrar'));
      }
    };
  </script>
</body>
</html>
`);
  } catch (error) {
    console.error("Error al mostrar formulario:", error);
    res.status(500).send("<h1>❌ Error interno</h1><p>No se pudo cargar el formulario.</p>");
  }
};

/**
 * Registra al cliente al completar el formulario
 */
exports.registrarCliente = async (req, res) => {
  const { token } = req.params;
  const { name, rif, password, repetirPassword } = req.body;

  try {
    const link = await RegistrationLink.findOne({ where: { token } });

    if (!link) {
      return res.status(400).json({ error: "Link no válido" });
    }

    if (link.used) {
      return res.status(400).json({ error: "Este link ya fue usado" });
    }

    if (new Date() > link.expiresAt) {
      return res.status(400).json({ error: "Este link ha expirado" });
    }

    if (!name || !rif || !password || !repetirPassword) {
      return res.status(400).json({
        error: "Todos los campos son obligatorios.",
      });
    }

    if (password !== repetirPassword) {
      return res.status(400).json({ error: "Las contraseñas no coinciden." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "La contraseña debe tener al menos 8 caracteres." });
    }

    if (!/(?=.*[A-Z])(?=.*\d)(?=.*[*\/+\-&\$])/.test(password)) {
      return res
        .status(400)
        .json({
          error:
            "La contraseña debe incluir mayúsculas, números y un carácter especial (* / + - $ &).",
        });
    }

    const secuencias = ["123", "234", "345", "456", "567", "678", "789"];
    if (secuencias.some((seq) => password.includes(seq))) {
      return res
        .status(400)
        .json({
          error:
            "La contraseña no debe contener secuencias numéricas consecutivas como 123.",
        });
    }

    if (!validateRif(rif)) {
      return res
        .status(400)
        .json({ error: "El formato del RIF no es válido." });
    }

    const existing = await Client.findOne({ where: { rif } });
    if (existing) {
      return res
        .status(409)
        .json({ error: "Ya existe un cliente con este RIF." });
    }

    let apiKey;
    do {
      apiKey = generateApiKey();
    } while (await Client.findOne({ where: { apiKey } }));

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const client = await Client.create({
      name,
      rif,
      apiKey,
      passwordHash,
      active: true,
    });

    // ✅ PASO 1: Crear las 5 tablas específicas para este cliente
    await ClientSchemaService.crearEsquemaParaCliente(client.id); 

    // ✅ PASO 2: Marcar el link como usado
    await link.update({ used: true, clientId: client.id });

    res.json({
      message: "Registrado exitosamente",
      apiKey: client.apiKey,
    });
  } catch (error) {
    console.error("Error al registrar cliente:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

/**
 * Página de éxito mostrando la API Key
 */
exports.successPage = (req, res) => {
  const filePath = path.join(__dirname, "../views/success.html");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error al enviar success.html:", err.message);
      res.status(500).send("<h1>📄 Página no disponible</h1>");
    }
  });
};
