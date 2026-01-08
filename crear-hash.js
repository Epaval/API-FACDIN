// crear-hash.js
const bcrypt = require('bcrypt');

const email = 'admin@facdin.com';
const password = 'admin123'; // ← puedes cambiar esta contraseña
const hashedPassword = bcrypt.hashSync(password, 10);

console.log(`
Empleado de prueba:
- Email: ${email}
- Contraseña: ${password}
- Hash: ${hashedPassword}
`);