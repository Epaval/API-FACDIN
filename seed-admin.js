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
    const plainPassword = 'Agente1126'; // ← Define aquí la contraseña real
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // Crear admin
    const admin = await Empleado.create({
      email: 'agente1@facdin.com',
      nombre: 'Julio Pérez',
      passwordHash,
      rol: 'agente',
      activo: true
    });

    console.log('🎉 Agente creado exitosamente:');
    console.log('Email: agente1@facdin.com');
    console.log('Contraseña:', plainPassword); // Mostrar la contraseña clara (solo en desarrollo)
    console.log('Rol:', agente.rol);

  } catch (error) {
    console.error('❌ Error al sembrar admin:', error.message);
    if (error.parent) console.error('SQL:', error.parent.message);
  } finally {
    await sequelize.close();
  }
}

seedAdmin();