// src/middleware/permisos.js

const PERMISOS = {
  asesor: ['abrir_caja', 'cerrar_caja', 'insertar_factura'],
  gae: ['abrir_caja', 'cerrar_caja', 'insertar_factura', 'insertar_nota'],
  ga: ['abrir_caja', 'cerrar_caja', 'insertar_factura', 'insertar_nota', 'consultar_tablas']
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