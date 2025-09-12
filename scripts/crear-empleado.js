// scripts/crear-empleado.js
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const { Empleado } = require('../src/models');

async function crearEmpleado() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    const [empleado, creado] = await Empleado.findOrCreate({
      where: { email: 'admin@facdin.com' },
      defaults: {
        nombre: 'Administrador FacDin',
        rol: 'admin',
        activo: true
      }
    });

    if (creado) {
      console.log('✅ Empleado creado:', empleado.toJSON());
    } else {
      console.log('ℹ️  El empleado ya existe:', empleado.toJSON());
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

crearEmpleado();