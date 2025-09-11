// src/models/Invoice.js
module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    rifEmisor: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^[JGVEP][0-9]{8,9}$/i
      }
    },
    razonSocialEmisor: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rifReceptor: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^[JGVEP][0-9]{8,9}$/i
      }
    },
    razonSocialReceptor: {
      type: DataTypes.STRING,
      allowNull: false
    },
    numeroControl: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    numeroFactura: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fechaEmision: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    iva: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('emitida', 'anulada'),
      defaultValue: 'emitida'
    },
    clientId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'clients',
        key: 'id'
      }
    }
  }, {
    tableName: 'invoices',
    timestamps: true
  });

  return Invoice;
};