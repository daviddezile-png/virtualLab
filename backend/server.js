require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const usersRoutes         = require('./routes/users');
const assignmentsRoutes   = require('./routes/assignments');
const submissionsRoutes   = require('./routes/submissions');
const classInvitesRoutes  = require('./routes/classInvites');
const qaRoutes            = require('./routes/qa');
const announcementsRoutes = require('./routes/announcements');
const auditRoutes         = require('./routes/audit');

// ── Middleware ────────────────────────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3543;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      200,
  message:  'Too many requests — please try again later.',
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request logging (development only) ───────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const { readyState } = require('mongoose').connection;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][readyState];
  res.json({
    status:      'OK',
    database:    dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime:      Math.round(process.uptime()),
    timestamp:   new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/assignments',   assignmentsRoutes);
app.use('/api/submissions',   submissionsRoutes);
app.use('/api/class-invites', classInvitesRoutes);
app.use('/api/qa',            qaRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/audit',         auditRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    error:   'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Connect to MongoDB then start server ──────────────────────────────────────
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Health:  http://localhost:${PORT}/health`);
    console.log(`🔗 API:     http://localhost:${PORT}/api\n`);
  });

  // If the port is already in use, kill the occupant and retry once
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${PORT} busy — killing occupant and retrying in 1s…`);
      const { execFileSync } = require('child_process');
      // Cross-platform port-free helper (works on Windows, macOS, Linux)
      try { execFileSync(process.execPath, [require('path').join(__dirname, 'scripts', 'free-port.js'), String(PORT)], { stdio: 'ignore' }); } catch (_) { /* nothing to kill */ }
      setTimeout(() => {
        server.close();
        app.listen(PORT, () => {
          console.log(`\n🚀 Server running on http://localhost:${PORT} (retry)\n`);
        });
      }, 1000);
    } else {
      console.error('❌ Server error:', err.message);
      process.exit(1);
    }
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(async () => {
      await require('mongoose').connection.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}).catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
