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
exports.mostrarFormulario = async (req, res) => {
  const { token } = req.params;

  try {
    const link = await RegistrationLink.findOne({ where: { token } });

    if (!link) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enlace Inválido - FacDin</title>
          <style>
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              padding: 20px;
            }
            .error-card {
              background: white; 
              padding: 40px; 
              border-radius: 20px; 
              box-shadow: 0 20px 60px rgba(0,0,0,0.3); 
              text-align: center; 
              max-width: 500px;
              animation: fadeIn 0.6s ease-out;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .error-icon { 
              font-size: 60px; 
              color: #ef4444; 
              margin-bottom: 20px;
            }
            h1 { 
              color: #1f2937; 
              margin-bottom: 10px; 
              font-weight: 700;
            }
            p { 
              color: #6b7280; 
              line-height: 1.6; 
              margin-bottom: 30px;
            }
            .btn-home {
              background: #3b82f6; 
              color: white; 
              padding: 12px 30px; 
              border-radius: 10px; 
              text-decoration: none; 
              font-weight: 600; 
              display: inline-block;
              transition: all 0.3s ease;
            }
            .btn-home:hover {
              background: #2563eb;
              transform: translateY(-2px);
              box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="error-card">
            <div class="error-icon">🔗</div>
            <h1>Enlace Inválido</h1>
            <p>El enlace de registro no existe o ha sido eliminado.</p>
            <a href="/" class="btn-home">Volver al Inicio</a>
          </div>
        </body>
        </html>
      `);
    }

    if (link.used) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enlace Usado - FacDin</title>
          <style>
            body { 
              font-family: 'Inter', sans-serif; 
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              min-height: 100vh; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              padding: 20px;
            }
            .card {
              background: white; 
              padding: 40px; 
              border-radius: 20px; 
              box-shadow: 0 20px 60px rgba(0,0,0,0.2); 
              text-align: center; 
              max-width: 500px;
            }
            .icon { 
              font-size: 60px; 
              color: #f59e0b; 
              margin-bottom: 20px;
            }
            h1 { 
              color: #1f2937; 
              margin-bottom: 15px; 
              font-weight: 700;
            }
            p { 
              color: #6b7280; 
              line-height: 1.6; 
              margin-bottom: 25px;
            }
            .btn { 
              background: #10b981; 
              color: white; 
              padding: 12px 30px; 
              border-radius: 10px; 
              text-decoration: none; 
              font-weight: 600; 
              display: inline-block;
              transition: transform 0.3s;
            }
            .btn:hover { 
              transform: translateY(-2px); 
              box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✅</div>
            <h1>¡Ya estás registrado!</h1>
            <p>Este enlace de registro ya fue utilizado. Si necesitas ayuda, contacta a soporte.</p>
            <a href="/login" class="btn">Ir al Login</a>
          </div>
        </body>
        </html>
      `);
    }

    const ahora = new Date();
    if (ahora > link.expiresAt) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enlace Expirado - FacDin</title>
          <style>
            body { 
              font-family: 'Inter', sans-serif; 
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              min-height: 100vh; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              padding: 20px;
            }
            .card {
              background: white; 
              padding: 40px; 
              border-radius: 20px; 
              box-shadow: 0 20px 60px rgba(0,0,0,0.2); 
              text-align: center; 
              max-width: 500px;
            }
            .icon { 
              font-size: 60px; 
              color: #ef4444; 
              margin-bottom: 20px;
            }
            h1 { 
              color: #1f2937; 
              margin-bottom: 15px; 
              font-weight: 700;
            }
            p { 
              color: #6b7280; 
              line-height: 1.6; 
              margin-bottom: 25px;
            }
            .btn { 
              background: #3b82f6; 
              color: white; 
              padding: 12px 30px; 
              border-radius: 10px; 
              text-decoration: none; 
              font-weight: 600; 
              display: inline-block;
              transition: transform 0.3s;
            }
            .btn:hover { 
              transform: translateY(-2px); 
              box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⏰</div>
            <h1>¡Enlace Expirado!</h1>
            <p>Este enlace de registro ha expirado. Solicita un nuevo enlace.</p>
            <a href="/" class="btn">Volver al Inicio</a>
          </div>
        </body>
        </html>
      `);
    }

    const expiresAtISO = link.expiresAt.toISOString();
    const { name = "", rif = "" } = link.meta || {};

    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registro - FacDin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #3b82f6;
      --primary-dark: #2563eb;
      --primary-light: #dbeafe;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-700: #374151;
      --gray-900: #111827;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --radius-lg: 1rem;
      --radius-md: 0.75rem;
      --radius-sm: 0.5rem;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      color: var(--gray-900);
    }

    .container {
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
    }

    .card {
      background: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: slideUp 0.5s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .header {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      padding: 2.5rem 2rem;
      text-align: center;
      position: relative;
    }

    .header::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
    }

    .logo {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      display: inline-block;
    }

    .header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .header p {
      font-size: 0.95rem;
      opacity: 0.9;
      font-weight: 300;
    }

    .timer {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.15);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-md);
      margin-top: 1rem;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .timer span {
      font-weight: 600;
      margin-left: 0.5rem;
    }

    .content {
      padding: 2.5rem 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--gray-700);
      margin-bottom: 0.5rem;
    }

    .input-wrapper {
      position: relative;
    }

    .input-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--gray-700);
      pointer-events: none;
    }

    .form-input {
      width: 100%;
      padding: 0.875rem 1rem 0.875rem 3rem;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-sm);
      font-size: 1rem;
      font-family: 'Inter', sans-serif;
      transition: all 0.2s ease;
      background: var(--gray-50);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      background: white;
      box-shadow: 0 0 0 3px var(--primary-light);
    }

    .form-input:read-only {
      background: var(--gray-100);
      color: var(--gray-700);
      cursor: not-allowed;
    }

    .form-input.valid {
      border-color: var(--success);
      background-color: rgba(16, 185, 129, 0.05);
    }

    .form-input.invalid {
      border-color: var(--danger);
      background-color: rgba(239, 68, 68, 0.05);
    }

    .validation-message {
      font-size: 0.75rem;
      margin-top: 0.375rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .validation-message.valid {
      color: var(--success);
    }

    .validation-message.invalid {
      color: var(--danger);
    }

    .password-strength {
      margin-top: 1rem;
    }

    .strength-meter {
      height: 6px;
      background: var(--gray-200);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .strength-fill {
      height: 100%;
      width: 0%;
      border-radius: 3px;
      transition: all 0.3s ease;
    }

    .strength-weak { background: var(--danger); width: 25%; }
    .strength-medium { background: var(--warning); width: 50%; }
    .strength-good { background: #f59e0b; width: 75%; }
    .strength-strong { background: var(--success); width: 100%; }

    .strength-text {
      font-size: 0.75rem;
      font-weight: 500;
      text-align: right;
    }

    .requirements {
      background: var(--gray-50);
      border-radius: var(--radius-sm);
      padding: 1rem;
      margin-top: 1rem;
    }

    .requirements h4 {
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
      color: var(--gray-700);
    }

    .requirement-item {
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .requirement-item.valid {
      color: var(--success);
    }

    .requirement-item.invalid {
      color: var(--gray-700);
    }

    .requirement-icon {
      font-size: 0.875rem;
    }

    .btn-submit {
      width: 100%;
      padding: 1rem;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .btn-submit:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--gray-200);
      color: var(--gray-700);
    }

    .footer {
      text-align: center;
      padding: 2rem;
      background: var(--gray-50);
      border-top: 1px solid var(--gray-200);
    }

    .footer p {
      font-size: 0.875rem;
      color: var(--gray-700);
      line-height: 1.5;
    }

    /* Responsive Design */
    @media (max-width: 640px) {
      .header, .content {
        padding: 1.5rem 1.25rem;
      }
      
      .header h1 {
        font-size: 1.5rem;
      }
      
      .form-input {
        padding: 0.75rem 0.875rem 0.75rem 2.5rem;
      }
      
      .input-icon {
        left: 0.875rem;
      }
    }

    @media (max-width: 480px) {
      body {
        padding: 0.5rem;
      }
      
      .card {
        border-radius: var(--radius-md);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">🔐</div>
        <h1>Activa tu Acceso</h1>
        <p>Completa tus datos para comenzar a usar FacDin</p>
        <div class="timer">
          ⏳ Tiempo restante: <span id="time">Cargando...</span>
        </div>
      </div>

      <div class="content">
        <form id="registroForm" novalidate>
          <!-- Nombre de la Empresa -->
          <div class="form-group">
            <label class="form-label">Nombre de la Empresa</label>
            <div class="input-wrapper">
              <span class="input-icon">🏢</span>
              <input 
                type="text" 
                name="name" 
                class="form-input" 
                placeholder="Ingresa el nombre de tu empresa" 
                value="${name || ''}"
                oninput="this.value = this.value.toUpperCase()"
                required
                autocomplete="organization"
              >
            </div>
          </div>

          <!-- RIF -->
          <div class="form-group">
            <label class="form-label">RIF</label>
            <div class="input-wrapper">
              <span class="input-icon">📋</span>
              <input 
                type="text" 
                name="rif" 
                class="form-input" 
                placeholder="J123456789" 
                value="${rif || ''}"
                oninput="this.value = this.value.toUpperCase()"
                maxlength="10"
                required
                autocomplete="off"
              >
            </div>
            <div class="validation-message" id="rif-validation"></div>
          </div>

          <!-- Contraseña -->
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <div class="input-wrapper">
              <span class="input-icon">🔒</span>
              <input 
                type="password" 
                name="password" 
                class="form-input" 
                id="password"
                placeholder="Crea una contraseña segura"
                required
                autocomplete="new-password"
              >
            </div>
            
            <div class="password-strength">
              <div class="strength-meter">
                <div class="strength-fill" id="strength-fill"></div>
              </div>
              <div class="strength-text" id="strength-text"></div>
            </div>

            <div class="requirements">
              <h4>Requisitos de la contraseña:</h4>
              <div class="requirement-item" id="req-length">
                <span class="requirement-icon">○</span>
                <span>Mínimo 8 caracteres</span>
              </div>
              <div class="requirement-item" id="req-uppercase">
                <span class="requirement-icon">○</span>
                <span>Al menos una mayúscula</span>
              </div>
              <div class="requirement-item" id="req-number">
                <span class="requirement-icon">○</span>
                <span>Al menos un número</span>
              </div>
              <div class="requirement-item" id="req-special">
                <span class="requirement-icon">○</span>
                <span>Al menos un carácter especial (* / + - $ &)</span>
              </div>
              <div class="requirement-item" id="req-sequence">
                <span class="requirement-icon">○</span>
                <span>Sin secuencias numéricas (123, 234, etc.)</span>
              </div>
            </div>
          </div>

          <!-- Confirmar Contraseña -->
          <div class="form-group">
            <label class="form-label">Confirmar Contraseña</label>
            <div class="input-wrapper">
              <span class="input-icon">🔒</span>
              <input 
                type="password" 
                name="repetirPassword" 
                class="form-input" 
                id="confirmPassword"
                placeholder="Repite tu contraseña"
                required
                autocomplete="new-password"
              >
            </div>
            <div class="validation-message" id="confirm-validation"></div>
          </div>

          <button type="submit" class="btn-submit" id="submitBtn" disabled>
            <span id="btn-text">Activar Acceso</span>
            <span id="btn-icon">→</span>
          </button>
        </form>
      </div>

      <div class="footer">
        <p>FacDin - Facturación Digital Inteligente</p>
        <p style="font-size: 0.75rem; margin-top: 0.5rem; color: var(--gray-700);">
          Tus datos están protegidos con encriptación de grado empresarial
        </p>
      </div>
    </div>
  </div>

  <script>
    // Configuración
    const expiresAt = new Date("${expiresAtISO}").getTime();
    let isFormValid = false;

    // Elementos del DOM
    const form = document.getElementById('registroForm');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const rifInput = document.querySelector('input[name="rif"]');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    const timeElement = document.getElementById('time');

    // Contador de tiempo
    function actualizarReloj() {
      const ahora = new Date().getTime();
      const diferencia = expiresAt - ahora;

      if (diferencia <= 0) {
        timeElement.textContent = 'Expirado';
        timeElement.style.color = '#ef4444';
        submitBtn.disabled = true;
        btnText.textContent = 'Tiempo Expirado';
        return;
      }

      const minutos = Math.floor(diferencia / (1000 * 60));
      const segundos = Math.floor((diferencia / 1000) % 60);
      timeElement.textContent = \`\${minutos.toString().padStart(2, '0')}:\${segundos.toString().padStart(2, '0')}\`;
    }

    actualizarReloj();
    setInterval(actualizarReloj, 1000);

    // Validación de RIF en tiempo real
    rifInput.addEventListener('input', function() {
      const rif = this.value.trim();
      const validationElement = document.getElementById('rif-validation');
      
      if (rif.length === 0) {
        this.classList.remove('valid', 'invalid');
        validationElement.textContent = '';
        return;
      }

      // Validar formato básico - CORREGIDO: regex simplificado
      const rifRegex = /^[JGVEPjvgep][0-9]{9}$/;
      if (rifRegex.test(rif)) {
        this.classList.add('valid');
        this.classList.remove('invalid');
        validationElement.textContent = '✓ Formato válido';
        validationElement.className = 'validation-message valid';
      } else {
        this.classList.add('invalid');
        this.classList.remove('valid');
        validationElement.textContent = '✗ Formato inválido (Ej: J123456789)';
        validationElement.className = 'validation-message invalid';
      }
    });

    // Validación de fortaleza de contraseña
    passwordInput.addEventListener('input', function() {
      const password = this.value;
      const strengthFill = document.getElementById('strength-fill');
      const strengthText = document.getElementById('strength-text');
      
      // Reiniciar clases
      strengthFill.className = 'strength-fill';
      
      // Verificar requisitos - CORREGIDO: la barra diagonal debe estar escapada
      const hasLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasNumber = /\\d/.test(password);
      const hasSpecial = /[*/+\\-&$]/.test(password); // CORREGIDO: barra diagonal escapada
      const hasNoSequence = !/(123|234|345|456|567|678|789)/.test(password);
      
      // Actualizar íconos de requisitos
      updateRequirement('req-length', hasLength);
      updateRequirement('req-uppercase', hasUppercase);
      updateRequirement('req-number', hasNumber);
      updateRequirement('req-special', hasSpecial);
      updateRequirement('req-sequence', hasNoSequence);
      
      // Calcular fuerza
      let strength = 0;
      if (hasLength) strength++;
      if (hasUppercase) strength++;
      if (hasNumber) strength++;
      if (hasSpecial) strength++;
      if (hasNoSequence) strength++;
      
      // Actualizar visualización de fuerza
      let strengthClass = '';
      let strengthLabel = '';
      
      switch(strength) {
        case 1:
        case 2:
          strengthClass = 'strength-weak';
          strengthLabel = 'Débil';
          break;
        case 3:
          strengthClass = 'strength-medium';
          strengthLabel = 'Media';
          break;
        case 4:
          strengthClass = 'strength-good';
          strengthLabel = 'Buena';
          break;
        case 5:
          strengthClass = 'strength-strong';
          strengthLabel = 'Muy Fuerte';
          break;
        default:
          strengthLabel = 'Muy Débil';
      }
      
      strengthFill.className = 'strength-fill ' + strengthClass;
      strengthText.textContent = strengthLabel;
      strengthText.style.color = getStrengthColor(strength);
      
      // Validar confirmación de contraseña
      validatePasswordMatch();
    });

    function updateRequirement(elementId, isValid) {
      const element = document.getElementById(elementId);
      element.className = isValid ? 'requirement-item valid' : 'requirement-item invalid';
      const icon = element.querySelector('.requirement-icon');
      icon.textContent = isValid ? '✓' : '○';
    }

    function getStrengthColor(strength) {
      switch(strength) {
        case 1:
        case 2:
          return '#ef4444';
        case 3:
          return '#f59e0b';
        case 4:
          return '#f59e0b';
        case 5:
          return '#10b981';
        default:
          return '#6b7280';
      }
    }

    // Validar coincidencia de contraseñas
    confirmInput.addEventListener('input', validatePasswordMatch);
    
    function validatePasswordMatch() {
      const password = passwordInput.value;
      const confirm = confirmInput.value;
      const validationElement = document.getElementById('confirm-validation');
      
      if (confirm.length === 0) {
        confirmInput.classList.remove('valid', 'invalid');
        validationElement.textContent = '';
        return;
      }
      
      if (password === confirm && password.length >= 8) {
        confirmInput.classList.add('valid');
        confirmInput.classList.remove('invalid');
        validationElement.textContent = '✓ Las contraseñas coinciden';
        validationElement.className = 'validation-message valid';
      } else {
        confirmInput.classList.add('invalid');
        confirmInput.classList.remove('valid');
        validationElement.textContent = '✗ Las contraseñas no coinciden';
        validationElement.className = 'validation-message invalid';
      }
    }

    // Validar formulario completo
    function validateForm() {
      const name = document.querySelector('input[name="name"]').value.trim();
      const rif = rifInput.value.trim();
      const password = passwordInput.value;
      const confirm = confirmInput.value;
      
      // Validar RIF - CORREGIDO: sin la bandera 'i'
      const rifRegex = /^[JGVEPjvgep][0-9]{9}$/;
      const isRifValid = rifRegex.test(rif);
      
      // Validar contraseña - CORREGIDO: regex con barra escapada
      const hasLength = password.length >= 8;
      const hasUppercase = /[A-Z]/.test(password);
      const hasNumber = /\\d/.test(password);
      const hasSpecial = /[*/+\\-&$]/.test(password); // CORREGIDO
      const hasNoSequence = !/(123|234|345|456|567|678|789)/.test(password);
      const isPasswordValid = hasLength && hasUppercase && hasNumber && hasSpecial && hasNoSequence;
      
      // Validar coincidencia
      const isMatchValid = password === confirm && password.length >= 8;
      
      // Validar nombre
      const isNameValid = name.length >= 3;
      
      isFormValid = isRifValid && isPasswordValid && isMatchValid && isNameValid;
      submitBtn.disabled = !isFormValid;
    }

    // Escuchar cambios en todos los inputs
    form.addEventListener('input', validateForm);

    // Envío del formulario
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      if (!isFormValid) {
        alert('Por favor, completa correctamente todos los campos.');
        return;
      }
      
      const ahora = new Date().getTime();
      if (ahora > expiresAt) {
        alert('❌ El tiempo de registro ha expirado.');
        return;
      }
      
      // Mostrar estado de carga
      submitBtn.disabled = true;
      btnText.textContent = 'Procesando...';
      btnIcon.textContent = '⏳';
      
      const formData = new FormData(this);
      const data = Object.fromEntries(formData);
      
      try {
        const response = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          // Éxito
          btnText.textContent = '¡Éxito!';
          btnIcon.textContent = '✅';
          submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          
          // Redireccionar después de 1.5 segundos
          setTimeout(() => {
            window.location.href = '/api/register/success?key=' + encodeURIComponent(result.apiKey);
          }, 1500);
        } else {
          // Error
          throw new Error(result.error || 'Error en el registro');
        }
      } catch (error) {
        // Restaurar botón
        submitBtn.disabled = false;
        btnText.textContent = 'Activar Acceso';
        btnIcon.textContent = '→';
        
        // Mostrar error
        alert('❌ Error: ' + error.message);
        console.error('Error en registro:', error);
      }
    });

    // Inicializar validación
    validateForm();
  </script>
</body>
</html>
    `);
  } catch (error) {
    console.error("Error al mostrar formulario:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - FacDin</title>
        <style>
          body { 
            font-family: 'Inter', sans-serif; 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            padding: 20px;
          }
          .card {
            background: white; 
            padding: 40px; 
            border-radius: 20px; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.2); 
            text-align: center; 
            max-width: 500px;
          }
          .icon { 
            font-size: 60px; 
            color: #ef4444; 
            margin-bottom: 20px;
          }
          h1 { 
            color: #1f2937; 
            margin-bottom: 15px; 
            font-weight: 700;
          }
          p { 
            color: #6b7280; 
            line-height: 1.6; 
            margin-bottom: 25px;
          }
          .btn { 
            background: #3b82f6; 
            color: white; 
            padding: 12px 30px; 
            border-radius: 10px; 
            text-decoration: none; 
            font-weight: 600; 
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">⚠️</div>
          <h1>Error del Servidor</h1>
          <p>No se pudo cargar el formulario de registro. Por favor, intenta nuevamente más tarde.</p>
          <a href="/" class="btn">Volver al Inicio</a>
        </div>
      </body>
      </html>
    `);
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
      return res.status(400).json({ 
        success: false,
        error: "Link no válido" 
      });
    }

    if (link.used) {
      return res.status(400).json({ 
        success: false,
        error: "Este link ya fue usado" 
      });
    }

    if (new Date() > link.expiresAt) {
      return res.status(400).json({ 
        success: false,
        error: "Este link ha expirado" 
      });
    }

    // Validaciones
    if (!name || !rif || !password || !repetirPassword) {
      return res.status(400).json({
        success: false,
        error: "Todos los campos son obligatorios."
      });
    }

    if (password !== repetirPassword) {
      return res.status(400).json({ 
        success: false,
        error: "Las contraseñas no coinciden." 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false,
        error: "La contraseña debe tener al menos 8 caracteres." 
      });
    }

    // CORREGIDO: la barra diagonal debe estar escapada en la regex
    if (!/(?=.*[A-Z])(?=.*\d)(?=.*[*\/+\-&\$])/.test(password)) {
      return res.status(400).json({
        success: false,
        error: "La contraseña debe incluir mayúsculas, números y un carácter especial (* / + - $ &)."
      });
    }

    const secuencias = ["123", "234", "345", "456", "567", "678", "789"];
    if (secuencias.some((seq) => password.includes(seq))) {
      return res.status(400).json({
        success: false,
        error: "La contraseña no debe contener secuencias numéricas consecutivas como 123."
      });
    }

    if (!validateRif(rif)) {
      return res.status(400).json({ 
        success: false,
        error: "El formato del RIF no es válido." 
      });
    }

    // Verificar si ya existe
    const existing = await Client.findOne({ where: { rif } });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Ya existe un cliente con este RIF."
      });
    }

    // Generar API Key única
    let apiKey;
    do {
      apiKey = generateApiKey();
    } while (await Client.findOne({ where: { apiKey } }));

    // Hash de contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Crear cliente
    const client = await Client.create({
      name,
      rif,
      apiKey,
      passwordHash,
      active: true,
    });

    // Crear esquema para el cliente
    await ClientSchemaService.crearEsquemaParaCliente(client.id);

    // Marcar link como usado
    await link.update({ used: true, clientId: client.id });

    // Log de auditoría
    console.log(`✅ Cliente registrado: ${name} (${rif})`);

    res.json({
      success: true,
      message: "Registrado exitosamente",
      apiKey: client.apiKey,
      clientId: client.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al registrar cliente:", error);
    res.status(500).json({ 
      success: false,
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Página de éxito mostrando la API Key
 */
exports.successPage = (req, res) => {
  const apiKey = req.query.key;
  
  if (!apiKey) {
    return res.redirect('/');
  }

  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Registro Exitoso! - FacDin</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --success: #10b981;
      --success-dark: #059669;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-900: #111827;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .success-card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      animation: fadeIn 0.6s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .success-icon {
      font-size: 80px;
      color: var(--success);
      margin-bottom: 20px;
      animation: bounce 2s infinite;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    h1 {
      color: var(--gray-900);
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: #6b7280;
      font-size: 16px;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    
    .api-key-container {
      background: var(--gray-50);
      border: 2px dashed #d1d5db;
      border-radius: 10px;
      padding: 20px;
      margin: 30px 0;
      position: relative;
    }
    
    .api-key-label {
      display: block;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 10px;
      text-align: left;
    }
    
    .api-key {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 15px;
      background: white;
      padding: 12px 15px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      word-break: break-all;
      user-select: all;
      cursor: pointer;
      transition: all 0.3s;
    }
    
    .api-key:hover {
      background: #f9fafb;
      border-color: var(--success);
    }
    
    .api-key.copied {
      background: #d1fae5;
      border-color: var(--success);
    }
    
    .copy-btn {
      background: var(--success);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }
    
    .copy-btn:hover {
      background: var(--success-dark);
      transform: translateY(-2px);
    }
    
    .copy-btn.copied {
      background: #059669;
    }
    
    .warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
      text-align: left;
    }
    
    .warning h3 {
      color: #92400e;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .warning ul {
      color: #92400e;
      font-size: 13px;
      padding-left: 20px;
      line-height: 1.5;
    }
    
    .warning li {
      margin-bottom: 5px;
    }
    
    .actions {
      display: flex;
      gap: 15px;
      margin-top: 30px;
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .btn {
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.3s;
      display: inline-block;
    }
    
    .btn-primary {
      background: var(--success);
      color: white;
    }
    
    .btn-primary:hover {
      background: var(--success-dark);
      transform: translateY(-2px);
    }
    
    .btn-secondary {
      background: var(--gray-100);
      color: var(--gray-900);
    }
    
    .btn-secondary:hover {
      background: #e5e7eb;
      transform: translateY(-2px);
    }
    
    .footer-note {
      margin-top: 25px;
      color: #9ca3af;
      font-size: 12px;
      line-height: 1.5;
    }
    
    @media (max-width: 640px) {
      .success-card {
        padding: 30px 20px;
      }
      
      .actions {
        flex-direction: column;
      }
      
      .btn {
        width: 100%;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="success-card">
    <div class="success-icon">🎉</div>
    <h1>¡Registro Exitoso!</h1>
    <p class="subtitle">Tu cuenta ha sido activada correctamente. Guarda tu API Key, es la única vez que la verás.</p>
    
    <div class="api-key-container">
      <span class="api-key-label">Tu API Key:</span>
      <div class="api-key" id="apiKey">${apiKey}</div>
    </div>
    
    <button class="copy-btn" id="copyBtn">
      <span id="copyIcon">📋</span>
      <span id="copyText">Copiar API Key</span>
    </button>
    
    <div class="warning">
      <h3>⚠️ Importante</h3>
      <ul>
        <li>Esta API Key es tu identificación única en el sistema</li>
        <li>No la compartas con nadie</li>
        <li>Guárdala en un lugar seguro</li>
        <li>La necesitarás para hacer todas las operaciones en la API</li>
      </ul>
    </div>
    
    <div class="actions">
      <a href="/login" class="btn btn-primary">Ir al Login</a>
      <a href="/" class="btn btn-secondary">Volver al Inicio</a>
    </div>
    
    <p class="footer-note">Si pierdes tu API Key, contacta a soporte para generar una nueva.</p>
  </div>
  
  <script>
    const apiKeyElement = document.getElementById('apiKey');
    const copyBtn = document.getElementById('copyBtn');
    const copyText = document.getElementById('copyText');
    const copyIcon = document.getElementById('copyIcon');
    
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(apiKeyElement.textContent);
        
        // Cambiar apariencia temporalmente
        copyText.textContent = '¡Copiada!';
        copyIcon.textContent = '✅';
        copyBtn.classList.add('copied');
        apiKeyElement.classList.add('copied');
        
        // Restaurar después de 2 segundos
        setTimeout(() => {
          copyText.textContent = 'Copiar API Key';
          copyIcon.textContent = '📋';
          copyBtn.classList.remove('copied');
          apiKeyElement.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar. Por favor, copia manualmente.');
      }
    });
    
    // Seleccionar automáticamente al hacer clic
    apiKeyElement.addEventListener('click', function() {
      const range = document.createRange();
      range.selectNodeContents(this);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  </script>
</body>
</html>
  `);
};
