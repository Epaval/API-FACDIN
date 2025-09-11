// src/services/pdfService.js
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Genera un PDF de bienvenida para un cliente recién registrado
 * @param {Object} client - Datos del cliente ({ name, rif, apiKey, fechaCreacion })
 * @returns {Promise<Uint8Array>} Buffer del PDF generado
 */
async function generarPdfBienvenida(client) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;

  const fechaDescarga = new Date().toLocaleString('es-VE', {
    timeZone: 'America/Caracas',    
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Título
  page.drawText(`Constancia de Registro - FacDin`, {
    x: 50,
    y: y,
    size: 20,
    font: boldFont,
    color: rgb(0, 0.3, 0.7),
  });

   y -= 25;
  page.drawText(`Fecha de descarga: ${fechaDescarga}`, {
    x: 50,
    y: y,
    size: 12,
    font,
    color: rgb(0.5, 0.5, 0.5)
  });
  y -= 40;

  // Línea separadora
  page.drawLine({
    start: { x: 50, y: y },
    end: { x: width - 50, y: y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 40;

  // Función para dibujar campo
  const drawField = (label, value) => {
    page.drawText(`${label}:`, { x: 50, y: y, size: 14, font: boldFont });
    page.drawText(value, { x: 180, y: y, size: 14, font });
    y -= 30;
  };

  drawField('Empresa', client.name);
  drawField('RIF', client.rif);
  drawField('API Key', client.apiKey);

  const fecha = new Date(client.fechaCreacion).toLocaleString('es-VE', {
    timeZone: 'America/Caracas'
  });
  drawField('Fecha y Hora', fecha);

 // Mensaje importante en varias líneas
const mensajeImportante = [
  'IMPORTANTE: Por tratarse de información sensible,',
  'le recomendamos conservar este documento',
  'en un entorno seguro y no compartirlo,',
  'salvo con personal estrictamente autorizado',
  'y de absoluta confianza.'
];
mensajeImportante.forEach(linea => {
  page.drawText(linea, { x: 50, y: y, size: 12, font, color: rgb(0.8, 0, 0) }); // Rojo oscuro
  y -= 20;
});

  y -= 30;
  page.drawText('FacDin - Sistema de Facturación. www.facdin.com', {
    x: 50, y: y, size: 10, font, color: rgb(0.5, 0.5, 0.5)
  });

  return await pdfDoc.save();
}

module.exports = { generarPdfBienvenida };