// src/models/Empleado.js
module.exports = (sequelize, DataTypes) => {
  const Empleado = sequelize.define('Empleado', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
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
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password_hash'
    },
    rol: {
      type: DataTypes.ENUM('admin', 'agente'),
      defaultValue: 'agente',
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'empleados',
    timestamps: true,
    underscored: true // Usa snake_case en DB
  });

  return Empleado;
};