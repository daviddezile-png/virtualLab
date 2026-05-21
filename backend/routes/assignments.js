const express    = require('express');
const { body, validationResult } = require('express-validator');
const Assignment = require('../models/Assignment');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/assignments ─── teacher sees own, admin sees all ─────────────────
router.get('/', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { teacherId: req.user.id };
    const assignments = await Assignment.find(query).sort({ createdAt: -1 });
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// ── POST /api/assignments ─────────────────────────────────────────────────────
router.post('/', requireRole('teacher', 'admin'), [
  body('token').notEmpty().trim().toUpperCase(),
  body('practicalId').isIn(['vanishing-cream', 'cold-cream']),
  body('targetGrams').optional().isFloat({ min: 1 }),
  body('timeLimitMinutes').optional().isInt({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const existing = await Assignment.findOne({ token: req.body.token.toUpperCase() });
    if (existing) return res.status(409).json({ error: 'Token already exists' });

    const assignment = await Assignment.create({
      ...req.body,
      token:       req.body.token.toUpperCase(),
      teacherId:   req.user.id,
      teacherName: req.body.teacherName || '',
    });

    res.status(201).json({ assignment });
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// ── GET /api/assignments/redeem/:token ── student redeems a code ──────────────
router.get('/redeem/:token', async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      token: req.params.token.toUpperCase(),
    });

    if (!assignment)
      return res.status(404).json({ error: 'Invalid code — no assignment found' });

    if (assignment.codeExpiresAt && new Date() > new Date(assignment.codeExpiresAt))
      return res.status(410).json({ error: 'This assignment code has expired' });

    if (assignment.maxUses > 0 && assignment.useCount >= assignment.maxUses)
      return res.status(410).json({ error: 'This code has reached its maximum number of uses' });

    // Increment use count
    assignment.useCount += 1;
    await assignment.save();

    res.json({ assignment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to redeem code' });
  }
});

// ── DELETE /api/assignments/:id ───────────────────────────────────────────────
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    if (req.user.role === 'teacher' && assignment.teacherId !== req.user.id)
      return res.status(403).json({ error: 'Not your assignment' });
    await assignment.deleteOne();
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

module.exports = router;
