// seed-admin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize } = require('./src/config/database');
const db = require('./src/models');

async function seedAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a PostgreSQL exitosa');

    const Empleado = db.Empleado;

    // Verificar si ya existe
    const existing = await Empleado.findOne({ where: { email: 'agente1@facdin.com' } });
    if (existing) {
      console.log('🟢 Ya existe un empleado admin.');
      console.log('Email:', existing.email);
      console.log('Nombre:', existing.nombre);
      return;
    }

    // Hashear contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('AgenteC1126', saltRounds);

    // Crear admin
    const agente1 = await Empleado.create({
      email: 'agente1@facdin.com',
      nombre: 'Agente de cuenta 1',
      passwordHash,
      rol: 'agente',
      activo: true
    });

    console.log('🎉 Admin creado exitosamente:');
    console.log('Email: admin@facdin.com');
    console.log('Contraseña: Admin1126'); // Solo para desarrollo
    console.log('Rol:', agente1.rol);

  } catch (error) {
    console.error('❌ Error al sembrar admin:', error.message);
    if (error.parent) console.error('SQL:', error.parent.message);
  } finally {
    await sequelize.close();
  }
}

seedAdmin();