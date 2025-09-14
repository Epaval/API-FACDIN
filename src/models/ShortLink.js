// src/models/ShortLink.js
module.exports = (sequelize, DataTypes) => {
  const ShortLink = sequelize.define('ShortLink', {
    short_id: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'short_links',
    timestamps: true,
    underscored: true // Usa snake_case para campos
  });

  return ShortLink;
};