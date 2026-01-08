 require("dotenv").config();

// ========================
// ✅ CONFIGURACIONES INICIALES
// ========================
const express = require("express");
const cors = require("cors");
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");

// Configuración del entorno
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

// ========================
// ✅ INICIALIZACIÓN DE SERVICIOS
// ========================
// Limpieza en producción
if (isProduction || process.env.ENABLE_CLEANUP === 'true') {
  const CleanupService = require('./services/CleanupService');
  new CleanupService().iniciar();
}

// ========================
// ✅ INICIALIZACIÓN DE EXPRESS
// ========================
const app = express();
const server = http.createServer(app);

// ========================
// ✅ CONFIGURACIÓN WEBSOCKET
// ========================
const io = socketIo(server, {
  cors: {
    origin: isProduction ? process.env.ALLOWED_ORIGINS?.split(',') || [] : "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Estado global de cajas
const estadoGlobalCajas = {
  caja1: { estado: 'cerrada', usuario: null, nombre: 'Caja Principal' },
  caja2: { estado: 'cerrada', usuario: null, nombre: 'Caja Secundaria' },
  caja3: { estado: 'cerrada', usuario: null, nombre: 'Caja Especial' }
};

// Configurar WebSocket
require('./src/config/socket')(io, estadoGlobalCajas);

// ========================
// ✅ CONEXIÓN A BASES DE DATOS
// ========================
const { sequelize } = require("./src/config/database");

// ========================
// ✅ IMPORTACIÓN DE RUTAS
// ========================
const apiRoutes = require("./src/routes");

// Configuración de rutas web
const WEB_ROUTES = [
  { route: '/', file: 'index.html' },
  { route: '/login', file: 'login.html' },
  { route: '/dashboard', file: 'dashboard.html' },
  { route: '/clientes', file: 'clientes.html' },
  { route: '/facturas', file: 'facturas.html' },
  { route: '/cajas', file: 'cajas.html' },
  { route: '/admin', file: 'admin.html' }
];

// ========================
// ✅ MIDDLEWARES
// ========================

// 1. Seguridad básica
app.use(helmet({
  contentSecurityPolicy: false // Ajustar según necesidades
}));

// 2. CORS
app.use(cors({
  origin: isProduction ? process.env.ALLOWED_ORIGINS?.split(',') || [] : "*",
  credentials: true
}));

// 3. Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'facdin-secret-key-change-in-production',
  resave: false,
  saveUninitialized: !isProduction, // Solo en desarrollo
  cookie: { 
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: isProduction ? 'strict' : 'lax'
  }
}));

// 4. Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Logging
if (!isProduction) {
  app.use(morgan('dev'));
}

// Middleware de logging personalizado
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('📥 Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
  }
  next();
});

// ========================
// ✅ RATE LIMITING
// ========================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
  standardHeaders: true,
  legacyHeaders: false
});

// ========================
// ✅ SERVIR ARCHIVOS ESTÁTICOS
// ========================
app.use(express.static('public', {
  maxAge: isProduction ? '1d' : 0,
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.html') {
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
  }
}));

// ========================
// ✅ RUTAS WEB (HTML SIN EXTENSIÓN)
// ========================
WEB_ROUTES.forEach(({ route, file }) => {
  const filePath = path.join(__dirname, 'public', file);
  
  if (fs.existsSync(filePath)) {
    app.get(route, (req, res) => {
      console.log(`📄 Sirviendo: ${file}`);
      res.sendFile(filePath);
    });
  } else {
    console.warn(`⚠️  Archivo no encontrado: ${file}`);
  }
});

// ========================
// ✅ RUTAS PÚBLICAS (antes de las rutas de API)
// ========================
const registerController = require('./src/controllers/registerController');
app.get('/register/:token', registerController.mostrarFormulario);
app.post('/register/:token', registerController.registrarCliente);
app.get('/api/register/success', registerController.successPage);

// ========================
// ✅ RUTAS DE API
// ========================

// Health Check (sin rate limit)
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version || '1.0.0'
  });
});

// Aplicar rate limit al resto de API
app.use("/api", apiLimiter, apiRoutes);

// Rutas específicas de módulos
const API_ROUTES = [
  { path: '/api/facturas', route: require('./src/routes/facturas') },
  { path: '/api/facturas', route: require('./src/routes/facturasToken') },
  { path: '/api/notas', route: require('./src/routes/nota') },
  { path: '/api/admin', route: require('./src/routes/admin') },
  { path: '/api/clientes', route: require('./src/routes/clients') },
  { path: '/api/caja', route: require('./src/routes/caja') },
  { path: '/api/auth', route: require('./src/routes/auth') },
  { path: '/api/usuarios', route: require('./src/routes/usuario') },   
  { path: '/', route: require('./src/routes/redirect') },    
];

API_ROUTES.forEach(({ path, route }) => {
  app.use(path, route);
}); 

// ========================
// ✅ MANEJO DE ERRORES
// ========================

// 404 - Endpoint no encontrado
app.use((req, res) => {
  const accept = req.headers.accept || '';
  
  if (accept.includes('html')) {
    const notFoundPath = path.join(__dirname, 'public', '404.html');
    if (fs.existsSync(notFoundPath)) {
      return res.status(404).sendFile(notFoundPath);
    }
  }
  
  res.status(404).json({
    error: "Endpoint no encontrado",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  const statusCode = err.statusCode || 500;
  const errorResponse = {
    error: isProduction ? "Error interno del servidor" : err.message,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  };

  if (!isProduction) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// ========================
// ✅ MANEJO DE PROCESO
// ========================

// Capturar señales para cierre limpio
const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`\n⚠️  Recibido ${signal}, cerrando servidor...`);
    
    try {
      await sequelize.close();
      console.log('✅ Conexión a PostgreSQL cerrada');
    } catch (err) {
      console.error('❌ Error cerrando PostgreSQL:', err.message);
    }
    
    server.close(() => {
      console.log('✅ Servidor HTTP cerrado');
      process.exit(0);
    });
    
    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      console.log('⏰ Forzando cierre del servidor');
      process.exit(1);
    }, 10000);
  });
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('⚠️  ERROR NO CAPTURADO:', error);
  if (isProduction) process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  PROMESA RECHAZADA:', reason);
});

// ========================
// ✅ INICIALIZAR SERVIDOR
// ========================
const startServer = async () => {
  try {
    // Conectar a PostgreSQL
    await sequelize.authenticate();
    console.log("✅ Conexión a PostgreSQL exitosa");

    // Cargar modelos
    require("./src/models");

    // Sincronizar modelos en desarrollo
    if (!isProduction) {
      await sequelize.sync({ alter: true });
      console.log("✅ Modelos sincronizados");
    }

    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`
🚀 ==============================================
   FacDin API iniciada correctamente
   📍 Entorno: ${isProduction ? 'Producción' : 'Desarrollo'}
   🔗 URL: http://localhost:${PORT}
   📊 Health: http://localhost:${PORT}/api/health
   🔌 WebSocket: ws://localhost:${PORT}
   ⏰ ${new Date().toLocaleString()}
============================================== 🚀
      `);
    });

  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
};

// Iniciar servidor
if (require.main === module) {
  startServer();
}

// ========================
// ✅ EXPORTACIONES
// ========================
module.exports = {
  app,
  server,
  io,
  estadoGlobalCajas,
  startServer 
};