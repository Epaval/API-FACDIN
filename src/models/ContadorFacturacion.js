// src/models/ContadorFacturacion.js
module.exports = (sequelize, DataTypes) => {
  const ContadorFacturacion = sequelize.define('ContadorFacturacion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    clienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id'
      },
      unique: true
    },
    ultimoNumeroFactura: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    ultimoNumeroControl: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    tableName: 'contador_facturacion',
    timestamps: true
  });

  

  return ContadorFacturacion;
};