// src/models/Client.js
const { validateRif } = require('../utils/validateRif');

module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rif: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isValidRif(value) {
          if (!validateRif(value)) {
            throw new Error('El RIF no es válido (dígito verificador incorrecto)');
          }
        }
      }
    },
    apiKey: {
      type: DataTypes.STRING(512),
      allowNull: false,
      unique: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'clients',
    timestamps: true
  });

  return Client;
};