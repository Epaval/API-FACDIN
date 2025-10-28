require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');

const { sequelize } = require("./src/config/database");
const apiRoutes = require("./src/routes");

const app = express();

// Crear servidor HTTP y Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Ajusta según tu dominio en producción
    methods: ["GET", "POST"]
  }
});

app.use((req, res, next) => {
  console.log('🔧 [INIT] Solicitud entrante:', req.method, req.url);
  next();
})

app.use(session({
  secret: process.env.SESSION_SECRET || 'tu-secreto-muy-seguro',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

const PORT = process.env.PORT || 3001;

// 🔥 Middlewares esenciales - VAN PRIMERO
app.use(express.json({ limit: '10mb', type: 'application/json' }));

app.use((req, res, next) => {
  console.log('📥 [BODY] Content-Type:', req.headers['content-type']);
  console.log('📥 [BODY] Body:', req.body || 'undefined');
  next();
});

// 🔐 Seguridad y utilidades
app.use(cors());
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ Rate Limit para /api
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 solicitudes por IP
});
app.use("/api", limiter);

// ✅ Rutas API
app.use("/api", apiRoutes);

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "FacDin API funcionando correctamente"
  });
});

// ========================
// ✅ RUTAS PÚBLICAS ESTÁTICAS
// ========================
app.use(express.static('public'));

//======= RUTAS FACTURAS ========
app.use('/api/facturas', require('./src/routes/facturas'));
app.use('/api/facturas', require('./src/routes/facturasToken'));

//======= RUTAS NOTAS =========
app.use('/api/notas', require('./src/routes/nota'));

//======= RUTAS ADMIN =========
app.use('/api/admin', require('./src/routes/admin'));

//========== RUTAS CAJAS =======
app.use('/api/caja', require('./src/routes/caja'));

//=========== TOKEN ===============
app.use('/', require('./src/routes/redirect'));

//========= RUTAS EMPLEADOS ====
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/usuarios', require('./src/routes/usuario'));

// ✅ Manejo de errores global
app.use((err, req, res, next) => {
  console.error("❌ [ERROR] ", err.stack);
  res.status(500).json({
    error: "Error interno del servidor"
  });
});

// ✅ Manejo de 404 - AL FINAL, SIN COMODINES
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint no encontrado",
    path: req.originalUrl
  });
});

// ========================
// ✅ WebSocket - Estado global de cajas
// ========================
// Estado global compartido entre todos los clientes
const estadoGlobalCajas = {
  caja1: { estado: 'cerrada', usuario: null, nombre: 'Caja Principal' },
  caja2: { estado: 'cerrada', usuario: null, nombre: 'Caja Secundaria' },
  caja3: { estado: 'cerrada', usuario: null, nombre: 'Caja Especial' }
};

// Escuchar conexiones WebSocket
io.on('connection', (socket) => {
  console.log('🔌 Nuevo cliente conectado:', socket.id);

  // Enviar estado actual de cajas al nuevo cliente
  socket.emit('estado-cajas', { type: 'estado-cajas', payload: estadoGlobalCajas });

  // Escuchar eventos de cambio de estado de cajas
  socket.on('cambiar-estado-caja', (data) => {
    const { cajaId, estado, usuario } = data.payload;
    
    if (estadoGlobalCajas[cajaId]) {
      estadoGlobalCajas[cajaId] = { 
        ...estadoGlobalCajas[cajaId], 
        estado, 
        usuario: estado === 'abierta' ? usuario : null 
      };
      
      // Emitir nuevo estado a todos los clientes conectados
      io.emit('estado-cajas', { type: 'estado-cajas', payload: estadoGlobalCajas });
      console.log(`🔄 Caja ${cajaId} ${estado} por ${usuario}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Cliente desconectado:', socket.id);
  });
});

// ========================
// ✅ Iniciar servidor
// ========================
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexión a PostgreSQL exitosa");

    // Cargar modelos (para relaciones)
    const db = require("./src/models");

    console.log('🔧 Servidor listo para escuchar');

    server.listen(PORT, () => {
      console.log(`🚀 FacDin API corriendo en http://localhost:${PORT}/`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
      console.log(`🔗 WebSocket escuchando en ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

startServer();

// Exportar io y server para usar en otros archivos
module.exports = { app, io, server };