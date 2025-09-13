const { tienePermiso } = require('../middleware/permisos');
const { insertarNota } = require('../controllers/notaController');

router.post('/nota', tienePermiso('insertar_nota'), insertarNota);