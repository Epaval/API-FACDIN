module.exports = (io, estadoGlobalCajas) => {
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    // Enviar estado actual
    socket.emit('estado-cajas', { 
      type: 'estado-cajas', 
      payload: estadoGlobalCajas 
    });
    
    // Cambiar estado de caja
    socket.on('cambiar-estado-caja', (data) => {
      const { cajaId, estado, usuario } = data.payload;
      
      if (estadoGlobalCajas[cajaId]) {
        estadoGlobalCajas[cajaId] = { 
          ...estadoGlobalCajas[cajaId], 
          estado, 
          usuario: estado === 'abierta' ? usuario : null 
        };
        
        io.emit('estado-cajas', { 
          type: 'estado-cajas', 
          payload: estadoGlobalCajas 
        });
        
        console.log(`🔄 Caja ${cajaId} ${estado} por ${usuario}`);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Cliente desconectado:', socket.id);
    });
  });
};