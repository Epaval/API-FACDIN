// scripts/listar-empleados.js
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const { Empleado } = require('../src/models');

async function listarEmpleados() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a la base de datos\n');
    
    const empleados = await Empleado.findAll({
      attributes: ['id', 'email', 'nombre', 'rol', 'activo', 'fechaCreacion'],
      order: [['fechaCreacion', 'DESC']]
    });
    
    console.log('📋 LISTA DE EMPLEADOS');
    console.log('=====================\n');
    
    if (empleados.length === 0) {
      console.log('No hay empleados registrados');
    } else {
      empleados.forEach((emp, index) => {
        console.log(`${index + 1}. ${emp.nombre}`);
        console.log(`   📧 Email: ${emp.email}`);
        console.log(`   🎯 Rol: ${emp.rol}`);
        console.log(`   ✅ Activo: ${emp.activo ? 'Sí' : 'No'}`);
        console.log(`   🆔 ID: ${emp.id}`);
        console.log(`   📅 Creado: ${emp.fechaCreacion}`);
        console.log('');
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listarEmpleados();