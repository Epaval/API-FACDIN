// generar-contrasena.js
const bcrypt = require('bcrypt');

async function generarHash() {
  const password = 'Admin1126'; // ← Cambia si quieres otra
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Contraseña:', password);
  console.log('Hash generado:');
  console.log(hash);
}

generarHash();