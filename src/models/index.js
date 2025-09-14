const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const basename = path.basename(__filename);
const db = {};

// Cargar todos los modelos automáticamente
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file !== 'index.js' &&
      file !== 'ContadorFacturacion.js' && 
      file !== basename &&
      file.endsWith('.js')
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, require('sequelize').DataTypes);
    const modelName = model.name || file.split('.')[0]; // Asegura el nombre
    db[modelName] = model;
  });

// === Relaciones ===
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

db.sequelize = sequelize;
db.Sequelize = require('sequelize');

module.exports = db;