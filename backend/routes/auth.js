const express  = require('express');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

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

    // Pending teachers are NOT given a token — they must wait for approval
    if (status === 'pending') {
      return res.status(201).json({
        pending: true,
        message: 'Registration submitted. Awaiting admin approval.',
        user: user.toPublicJSON(),
      });
    }

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

    user.lastLogin = new Date();
    await user.save();

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
