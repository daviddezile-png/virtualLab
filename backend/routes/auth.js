const express  = require('express');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { authenticate } = require('../middleware/auth');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

// Record an audit entry without blocking the response — a logging failure must
// never break sign-in or registration.
async function recordAudit(action, user, detail) {
  try {
    await AuditLog.create({
      action,
      actorId:   user.clientId,
      actorName: user.fullName,
      actorRole: user.role,
      detail,
    });
  } catch (err) {
    console.error('Audit write failed:', err.message);
  }
}

const signToken = (user) =>
  jwt.sign({ id: user.clientId, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', [
  body('role').isIn(['teacher', 'student']).withMessage('Role must be teacher or student'),
  body('fullName').notEmpty().trim().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { role, fullName, email, password, regNumber, forceActive } = req.body;

  if (role === 'student' && !regNumber?.trim())
    return res.status(400).json({ error: 'Registration number is required for students' });

  try {
    const settings = await Settings.getSingleton();

    // Maintenance mode / closed registration block self-service sign-ups.
    // (Accounts created on a user's behalf by an admin go through /api/users.)
    if (settings.maintenanceMode)
      return res.status(503).json({ error: 'The platform is in maintenance mode. Please try again later.' });
    if (!settings.openRegistration)
      return res.status(403).json({ error: 'New registrations are currently closed. Please contact your administrator.' });

    // Enforce the student account cap.
    if (role === 'student') {
      const activeStudents = await User.countDocuments({ role: 'student', status: 'active' });
      if (activeStudents >= settings.maxStudents)
        return res.status(403).json({ error: 'The maximum number of student accounts has been reached. Please contact your administrator.' });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await User.hashPassword(password);
    const status = (role === 'teacher' && !forceActive) ? 'pending' : 'active';
    const clientId = `u${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const user = await User.create({
      clientId, role, fullName, email,
      regNumber: role === 'student' ? regNumber.trim() : null,
      passwordHash, status,
    });

    await recordAudit('user_registered', user, `${fullName} registered as ${role}`);

    // Pending teachers wait for approval — no token issued
    if (status === 'pending') {
      return res.status(201).json({
        pending: true,
        message: 'Registration submitted. Awaiting admin approval.',
        user: user.toPublicJSON(),
      });
    }

    // forceActive means an admin/teacher created this account on behalf of someone else.
    // Return the user but NO token so the caller's session is never overwritten.
    if (forceActive) {
      return res.status(201).json({ created: true, user: user.toPublicJSON() });
    }

    // Normal self-registration — issue a token so the user is logged in immediately
    return res.status(201).json({
      token: signToken(user),
      user:  user.toPublicJSON(),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: 'No account found with that email' });

    const ok = await user.comparePassword(password);
    if (!ok)
      return res.status(401).json({ error: 'Incorrect password' });

    if (user.status === 'pending')
      return res.status(403).json({
        error: 'Your account is awaiting admin approval. You will be notified when access is granted.',
      });

    if (user.status === 'rejected')
      return res.status(403).json({
        error: 'Your account registration has been rejected. Please contact your administrator.',
      });

    if (user.suspended)
      return res.status(403).json({ error: 'Your account has been suspended.' });

    // During maintenance only admins may sign in.
    if (user.role !== 'admin') {
      const settings = await Settings.getSingleton();
      if (settings.maintenanceMode)
        return res.status(503).json({ error: 'The platform is in maintenance mode. Please try again later.' });
    }

    user.lastLogin = new Date();
    await user.save();

    await recordAudit('user_login', user, `${user.fullName} (${user.role}) signed in`);

    res.json({ token: signToken(user), user: user.toPublicJSON() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ clientId: req.user.id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
