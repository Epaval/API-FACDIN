// src/services/rifService.js
const axios = require('axios');

/**
 * Consulta un RIF en el servicio externo de ingenix21 (réplica SENIAT)
 * @param {string} rif - RIF limpio (ej: J002711442)
 * @returns {Promise<Object|null>} Datos del RIF o null si no se puede verificar
 */
async function consultarRIF(rif) {
  const clean = rif.toUpperCase().replace(/[-\s]/g, '');

  // Validación básica antes de la consulta
  if (!/^[JGVEP][0-9]{8,9}$/.test(clean)) {
    throw new Error('Formato de RIF inválido');
  }

  const url = `http://host2.ingenix21.com.ve:6080/cgi-bin/sinfonix.pl?${clean}`;

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'FacDin-API/1.0 (Facturación Digital Venezuela)'
      }
    });

    const html = response.data;

    if (typeof html !== 'string') return null;

    // Extraer datos clave usando expresiones regulares
    const razonMatch = html.match(/<b>Razón Social:<\/b>\s*([^<]+)</i);
    const estadoMatch = html.match(/<b>Estado:<\/b>\s*([^<]+)</i);
    const municipioMatch = html.match(/<b>Municipio:<\/b>\s*([^<]+)</i);

    return {
      valido: true,
      rif: clean,
      razonSocial: razonMatch ? razonMatch[1].trim() : null,
      estado: estadoMatch ? estadoMatch[1].trim() : null,
      municipio: municipioMatch ? municipioMatch[1].trim() : null,
      fuente: 'ingenix21',
      verificado: true
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.warn(`[RIF Service] Tiempo agotado para ${clean}`);
    } else if (error.response?.status === 404) {
      console.log(`[RIF Service] No encontrado: ${clean}`);
    } else {
      console.warn(`[RIF Service] Error al consultar ${clean}:`, error.message);
    }

    // Devuelve null para indicar "no disponible", no error crítico
    return null;
  }
}

module.exports = { consultarRIF };