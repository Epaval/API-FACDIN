// src/models/index.js
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const db = {};

// Cargar todos los modelos automáticamente
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file !== 'index.js' &&
      file !== 'ContadorFacturacion.js' && // ⚠️ Eliminado: ya no se usa tabla global
      file.endsWith('.js')
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, require('sequelize').DataTypes);
    db[model.name] = model;
  });

// === Relaciones ===

// Cliente tiene muchas facturas (si usas el modelo Invoice)
if (db.Client && db.Invoice) {
  db.Client.hasMany(db.Invoice, {
    foreignKey: 'clientId',
    as: 'invoices'
  });
  db.Invoice.belongsTo(db.Client, {
    foreignKey: 'clientId',
    as: 'client'
  });
}


// Guardar instancias
db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;