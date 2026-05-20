const express    = require('express');
const { body, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/submissions ──────────────────────────────────────────────────────
// Students see only their own; teachers & admins see all
router.get('/', async (req, res) => {
  try {
    const { practicalId, result, mode, studentId } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      query.studentId = req.user.id;
    } else if (studentId) {
      query.studentId = studentId;
    }

    if (practicalId) query.practicalId = practicalId;
    if (result)      query.result      = result;
    if (mode)        query.mode        = mode;

    const submissions = await Submission.find(query).sort({ submittedAt: -1 });
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ── GET /api/submissions/stats ─── summary statistics ─────────────────────────
router.get('/stats', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const stats = await Submission.getStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── POST /api/submissions ─── save an evaluation result ──────────────────────
router.post('/', [
  body('practicalId').isIn(['vanishing-cream', 'cold-cream']),
  body('mode').isIn(['assignment', 'practice']),
  body('result').isIn(['PASS', 'AVERAGE', 'FAIL']),
  body('submittedAt').isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const { clientId } = req.body;

    // Idempotent: if the same clientId already exists, return it
    if (clientId) {
      const existing = await Submission.findOne({ clientId });
      if (existing) return res.status(200).json({ submission: existing });
    }

    const submission = await Submission.create({
      ...req.body,
      studentId:   req.user.id,
      studentName: req.body.studentName || '',
      synced:      true,
    });

    res.status(201).json({ submission });
  } catch (err) {
    console.error('Save submission error:', err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

module.exports = router;
