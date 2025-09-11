// src/models/index.js
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

const db = {};

fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js' && file.endsWith('.js'))
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, require('sequelize').DataTypes);
    db[model.name] = model;
  });

// Relaciones
if (db.Invoice && db.Client) {
  db.Invoice.belongsTo(db.Client, { foreignKey: 'clientId', as: 'client' });
  db.Client.hasMany(db.Invoice, { foreignKey: 'clientId', as: 'invoices' });
}

db.sequelize = sequelize;
module.exports = db;