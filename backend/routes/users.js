const express = require('express');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All user management endpoints require authentication
router.use(authenticate);

// ── GET /api/users ─── list all users (admin only) ───────────────────────────
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const query = {};
    if (role)   query.role   = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fullName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { regNumber: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(query).sort({ createdAt: -1 }).select('-passwordHash');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/users/students ── teacher + admin can list students ──────────────
router.get('/students', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { search, classId } = req.query;
    const query = { role: 'student', status: 'active', suspended: { $ne: true } };

    // Teachers only see students who joined their class via invitation code
    if (req.user.role === 'teacher') {
      query.assignedTeacherId = req.user.id;
    }

    // Optional class filter (a ClassInvite _id). Narrows to one class.
    if (classId) {
      query.assignedClassId = classId;
    }

    if (search) {
      query.$or = [
        { fullName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { regNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .select('clientId role fullName email regNumber status createdAt lastLogin assignedTeacherId assignedTeacherName assignedClassId assignedClassName');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ── GET /api/users/counts ── dashboard stats (teacher + admin) ────────────────
router.get('/counts', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const students = await User.countDocuments({ role: 'student', status: 'active' });

    if (isAdmin) {
      // Admins get the full breakdown
      const [teachers, admins] = await Promise.all([
        User.countDocuments({ role: 'teacher', status: 'active' }),
        User.countDocuments({ role: 'admin' }),
      ]);
      return res.json({ students, teachers, admins, total: students + teachers + admins });
    }

    // Teachers only see student count — no visibility into peer/admin accounts
    res.json({ students, teachers: 0, admins: 0, total: students });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// ── GET /api/users/pending-teachers ── admin only ─────────────────────────────
router.get('/pending-teachers', requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ role: 'teacher', status: 'pending' })
      .sort({ createdAt: -1 }).select('-passwordHash');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending teachers' });
  }
});

// ── POST /api/users ─── admin creates any user ────────────────────────────────
router.post('/', requireRole('admin'), [
  body('role').isIn(['admin', 'teacher', 'student']).withMessage('Invalid role'),
  body('fullName').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  const { role, fullName, email, password, regNumber } = req.body;

  if (role === 'student' && !regNumber?.trim())
    return res.status(400).json({ error: 'Registration number is required for students' });

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const clientId      = `u${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const passwordHash  = await User.hashPassword(password);

    const user = await User.create({
      clientId, role, fullName, email,
      regNumber: role === 'student' ? regNumber.trim() : null,
      passwordHash,
      status: 'active',   // admin-created users are active immediately
    });

    res.status(201).json({ user: user.toPublicJSON() });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── PATCH /api/users/:clientId/approve ── admin only ─────────────────────────
router.patch('/:clientId/approve', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { clientId: req.params.clientId },
      { status: 'active' },
      { new: true }
    ).select('-passwordHash');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// ── PATCH /api/users/:clientId/reject ── admin only ──────────────────────────
router.patch('/:clientId/reject', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { clientId: req.params.clientId },
      { status: 'rejected' },
      { new: true }
    ).select('-passwordHash');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

// ── PATCH /api/users/:clientId/suspend ── admin only ─────────────────────────
router.patch('/:clientId/suspend', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findOne({ clientId: req.params.clientId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.suspended = !user.suspended;
    await user.save();
    res.json({ user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle suspension' });
  }
});

// ── DELETE /api/users/:clientId ── admin only ─────────────────────────────────
router.delete('/:clientId', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findOne({ clientId: req.params.clientId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.seeded) return res.status(403).json({ error: 'Seeded admin cannot be deleted' });
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
