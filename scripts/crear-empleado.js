require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const { sequelize } = require('../src/config/database');
const { Empleado } = require('../src/models');

async function crearEmpleado() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    const email = 'ahitza-admin@facdin.com';
    const nombre = 'Ahitza Martinez';
    const password = 'password123'; // Cambiar en producción
    const passwordHash = await bcrypt.hash(password, 10);

    const [empleado, creado] = await Empleado.findOrCreate({
      where: { email },
      defaults: {
        nombre,
        passwordHash,
        rol: 'admin',
        activo: true
      }
    });

    if (creado) {
      console.log('\n✅ EMPLEADO CREADO EXITOSAMENTE');
      console.log('===============================');
      console.log(`📧 Email: ${email}`);
      console.log(`👤 Nombre: ${nombre}`);
      console.log(`🔑 Contraseña temporal: ${password}`);
      console.log(`🎯 Rol: admin`);
      console.log('\n⚠️  IMPORTANTE: Cambia la contraseña en el primer inicio');
    } else {
      console.log('ℹ️  El empleado ya existe en el sistema');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

crearEmpleado();
