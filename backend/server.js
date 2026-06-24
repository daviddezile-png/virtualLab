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
const settingsRoutes      = require('./routes/settings');
const analyticsRoutes     = require('./routes/analytics');
const reportsRoutes       = require('./routes/reports');
const loggingRoutes       = require('./routes/logging');

// ── Middleware ────────────────────────────────────────────────────────────────
const errorHandler = require('./middleware/errorHandler');
const { authenticate, requireRole } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3543;

// ── Trust proxy ───────────────────────────────────────────────────────────────
// Behind a reverse proxy / platform load balancer (Render, Railway, Nginx,
// Cloudflare…) the real client IP arrives in X-Forwarded-For. Trust one hop so
// req.ip and the rate limiter key on the *actual* client instead of the shared
// proxy IP — otherwise every user shares a single rate-limit bucket and one
// busy client can 429 everyone else, including login.
// Override with TRUST_PROXY: "false" when no proxy sits in front (so clients
// can't spoof X-Forwarded-For to dodge the limiter), or a hop count / preset.
const TRUST_PROXY = process.env.TRUST_PROXY ?? '1';
app.set('trust proxy', TRUST_PROXY === 'false' ? false : Number(TRUST_PROXY) || TRUST_PROXY);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// A generous per-IP cap on the API as a whole to blunt abuse, plus a separate,
// stricter bucket on auth routes. Keeping them separate means dashboard refreshes
// (many reads per page) can never use up the login/registration budget, and vice
// versa. Both emit standard RateLimit-* / Retry-After headers so the client can
// react instead of silently failing.
const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,   // 15 minutes
  max:             1000,             // per client IP, across the whole API
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests — please slow down and try again shortly.' },
});

const authLimiter = rateLimit({
  windowMs:               15 * 60 * 1000,
  max:                    30,        // failed login/register attempts per IP
  standardHeaders:        true,
  legacyHeaders:          false,
  skipSuccessfulRequests: true,      // only count failures → real users aren't locked out
  message:                { error: 'Too many login attempts — please wait a few minutes and try again.' },
});

app.use('/api', apiLimiter);

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
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][readyState] || 'unknown';
  // The server can answer while Mongo is down — report that honestly as DEGRADED
  // so the dashboard never shows "Online" over a disconnected database.
  res.json({
    status:      dbStatus === 'connected' ? 'OK' : 'DEGRADED',
    database:    dbStatus,
    environment: process.env.NODE_ENV || 'development',
    uptime:      Math.round(process.uptime()),
    timestamp:   new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/assignments',   assignmentsRoutes);
app.use('/api/submissions',   submissionsRoutes);
app.use('/api/class-invites', classInvitesRoutes);
app.use('/api/qa',            qaRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/settings',      settingsRoutes);

// Analytics & reporting — read-only, restricted to teaching staff and admins.
app.use('/api/analytics', authenticate, requireRole('teacher', 'admin'), analyticsRoutes);
app.use('/api/reports',   authenticate, requireRole('teacher', 'admin'), reportsRoutes);

// Raw telemetry ingestion/queries (used by the simulation engine).
app.use('/api/log', loggingRoutes);

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
