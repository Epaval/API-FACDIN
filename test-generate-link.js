require('dotenv').config();
const { sequelize } = require('./src/config/database');
const db = require('./src/models');

async function probarFlujo() {
  try {
    // Conectar a BD
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL exitosa');

    const RegistrationLink = db.RegistrationLink;
    const token = require('crypto').randomBytes(32).toString('hex');

    const link = await RegistrationLink.create({
      token,
      createdBy: 'admin@facdin.com',
      expiresAt: new Date(Date.now() + 3 * 60 * 1000) // 3 minutos
    });

    const url = `http://localhost:3001/api/register/${link.token}`;
    console.log('\n🔗 Link de registro generado:');
    console.log(url);
    console.log('⏳ Válido por 180 segundos');
    console.log('💡 Ábrelo en el navegador para probar el flujo\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.parent) console.error('SQL:', error.parent.message);
  }
}

probarFlujo();