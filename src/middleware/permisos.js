// src/middleware/permisos.js

const PERMISOS = {
  cajero: ['abrir_caja', 'cerrar_caja', 'insertar_factura'],
  supervisor: ['abrir_caja', 'cerrar_caja', 'insertar_factura', 'insertar_nota'],
  admin: ['abrir_caja', 'cerrar_caja', 'insertar_factura', 'insertar_nota', 'consultar_tablas']
};

exports.tienePermiso = (accion) => {
  return (req, res, next) => {
    const { rol } = req.empleado; // Ahora sí existe

    if (!PERMISOS[rol]) {
      return res.status(403).json({ error: 'Rol no autorizado' });
    }

    if (!PERMISOS[rol].includes(accion)) {
      return res.status(403).json({ error: `No tienes permiso para realizar '${accion}'` });
    }

    next();
  };
};