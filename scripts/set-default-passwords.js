
// scripts/set-default-passwords.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize } = require('../src/config/database');
const { Client } = require('../src/models');

const DEFAULT_PASSWORD = '000000';
const SALT_ROUNDS = 10;

async function setDefaultPasswords() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a BD exitosa');

    const clients = await Client.findAll({
      where: { passwordHash: null }
    });

    if (clients.length === 0) {
      console.log('🟢 No hay clientes sin contraseña.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    for (const client of clients) {
      await client.update({ passwordHash });
      console.log(`🔐 Contraseña asignada al cliente: ${client.name} (${client.rif})`);
    }

    console.log(`✅ Contraseña '000000' asignada a ${clients.length} cliente(s).`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setDefaultPasswords();