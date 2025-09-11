/**
 * Valida el formato de un RIF venezolano según normas SENIAT
 * Formato esperado: [JGVEP][0-9]{8,9}
 * Ejemplos válidos: J12345678, V-123456789, G-00123456-7
 */
function validateRif(rif) {
  // Validar entrada
  if (!rif || typeof rif !== 'string') {
    return false;
  }

  // Limpiar cadena: eliminar guiones, espacios, convertir a mayúsculas
  const clean = rif.toUpperCase().replace(/[-\s]/g, '');

  // Expresión regular: Letra inicial (J,G,V,E,P) + 8 o 9 dígitos
  const regex = /^[JGVEP][0-9]{8,9}$/;

  return regex.test(clean);
}

// Exportación compatible con CommonJS (requerida para evitar errores en Node.js)
module.exports = { validateRif };