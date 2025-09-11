// src/controllers/rifController.js
const { validateRif } = require('../utils/validateRif');


exports.validateRif = (req, res) => {
  const { rif } = req.body;

  // Validar que se envió el campo
  if (!rif || typeof rif !== 'string') {
    return res.status(400).json({
      valid: false,
      error: 'El campo "rif" es obligatorio y debe ser una cadena de texto.'
    });
  }

  // Normalizar RIF (eliminar espacios, guiones, etc.)
  const clean = rif.trim().toUpperCase();
  const formatted = formatRif(clean); // Formato J-12345678-9

  // Validar con algoritmo SENIAT
  const isValid = validateRif(clean);

  if (!isValid) {
    return res.status(400).json({
      valid: false,
      input: rif,
      formatted,
      error: 'El RIF no es válido. Verifique el formato y el dígito verificador.'
    });
  }

  // Obtener tipo de contribuyente
  const tipo = getTipoContribuyente(clean.charAt(0));

  res.json({
    valid: true,
    input: rif,
    formatted,
    type: tipo,
    message: 'El RIF es válido según las reglas del SENIAT.'
  });
};

// Formatea el RIF como J-12345678-9
function formatRif(rif) {
  const clean = rif.replace(/[-\s]/g, '');
  const letra = clean.charAt(0);
  const numeros = clean.slice(1, -1);
  const digito = clean.charAt(clean.length - 1);
  return `${letra}-${numeros}-${digito}`;
}

// Devuelve el tipo de contribuyente
function getTipoContribuyente(letra) {
  const tipos = {
    V: 'Persona Natural',
    E: 'Extranjero',
    J: 'Persona Jurídica',
    G: 'Órgano Gubernamental',
    P: 'Patrimonio Autónomo'
  };
  return tipos[letra] || 'Desconocido';
}