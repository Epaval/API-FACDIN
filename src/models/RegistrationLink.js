// src/models/RegistrationLink.js
module.exports = (sequelize, DataTypes) => {
  const RegistrationLink = sequelize.define('RegistrationLink', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    token: { // ✅ Obligatorio
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,         
    },
    clientId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'clients',
        key: 'id'
      }
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'registration_links',
    timestamps: true
  });

  return RegistrationLink;
};