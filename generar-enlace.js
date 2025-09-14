// generar-enlace.js
require('dotenv').config();
const { sequelize } = require('./src/config/database');
const db = require('./src/models');

async function generarNuevoEnlace() {
  const transaction = await sequelize.transaction();

  try {
    // Paso 1: Generar un token único
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex'); // Token largo seguro

    // Paso 2: Crear el registro en registration_links
    const RegistrationLink = db.RegistrationLink;
    const shortId = Math.random().toString(36).substring(2, 10); // Ej: a7b2x9k1

    const link = await RegistrationLink.create({
      token,
      used: false,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutos
      createdBy: 'admin@facdin.com'
    }, { transaction });

    // Paso 3: Crear el enlace acortado (si usas la tabla short_links)
    const ShortLink = db.ShortLink;
    if (ShortLink) {
      await ShortLink.create({
        short_id: shortId,
        token,
        expires_at: new Date(Date.now() + 3 * 60 * 1000)
      }, { transaction });
    }

    await transaction.commit();

    // Paso 4: Construir URLs
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
    const enlaceAcortado = `${baseUrl}/r/${shortId}`;
    const enlaceDirecto = `${baseUrl}/api/register/${token}`;

    console.log('\n✅ Enlace acortado generado:');
    console.log(enlaceAcortado);
    console.log('\n🔗 Enlace directo (opcional):');
    console.log(enlaceDirecto);
    console.log('\n📌 Envíalo al cliente. Cada enlace es único y de un solo uso.');
    console.log('   Permite crear un nuevo cliente desde cero.');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error generando enlace:', error.message);
    if (error.parent) console.error('SQL:', error.parent.message);
  } finally {
    await sequelize.close();
  }
}

// === Ejecutar ===
generarNuevoEnlace();