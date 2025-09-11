// src/config/database.js
const { Sequelize } = require('sequelize');

const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: console.log,
  define: {
    timestamps: true,
    createdAt: 'fechaCreacion',
    updatedAt: 'fechaActualizacion'
  }
});

module.exports = { sequelize };