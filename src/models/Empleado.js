// src/models/Empleado.js
module.exports = (sequelize, DataTypes) => {
  const Empleado = sequelize.define('Empleado', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        isInFacdinDomain(value) {
          if (!value.endsWith('@facdin.com')) {
            throw new Error('Solo correos @facdin.com están autorizados');
          }
        }
      }
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    rol: {
      type: DataTypes.ENUM('admin', 'agente'),
      defaultValue: 'agente'
    }
  }, {
    tableName: 'empleados',
    timestamps: true
  });

  return Empleado;
};