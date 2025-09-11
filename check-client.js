// check-client.js
const { Client } = require('./src/models');

async function verificar() {
  const client = await Client.findOne({ where: { rif: 'J112233445' } });
  if (client) {
    console.log('✅ Cliente encontrado:', client.toJSON());
  } else {
    console.log('❌ No se encontró el cliente');
  }
}

verificar();