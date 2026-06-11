const express    = require('express');
const { body, validationResult } = require('express-validator');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/submissions ──────────────────────────────────────────────────────
// Students → own submissions only
// Teachers → practice submissions (all) + assignment submissions for their own codes only
// Admins   → everything, with optional studentId filter
router.get('/', async (req, res) => {
  try {
    const { practicalId, result, mode, studentId } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      // Students can only see their own
      query.studentId = req.user.id;
    } else if (req.user.role === 'teacher') {
      // Teachers see only student submissions — never teacher/admin rows
      query.submitterRole = { $ne: 'teacher' };
      // For assignment-mode submissions: only show those created with this teacher's codes.
      // Practice-mode submissions have no token, so all teachers see those.
      const teacherAssignments = await Assignment.find({ teacherId: req.user.id }).select('token');
      const teacherTokens = teacherAssignments.map(a => a.token).filter(Boolean);
      query.$or = [
        { mode: 'practice' },
        { mode: 'assignment', token: { $in: teacherTokens } },
      ];
      if (studentId) query.studentId = studentId;
    } else if (studentId) {
      // Admin with optional filter
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

// ── GET /api/submissions/stats ─────────────────────────────────────────────────
router.get('/stats', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const stats = await Submission.getStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── POST /api/submissions ── only students can submit lab evaluations ──────────
router.post('/', requireRole('student'), [
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

    // Idempotent: same clientId already saved → return it
    if (clientId) {
      const existing = await Submission.findOne({ clientId });
      if (existing) return res.status(200).json({ submission: existing });
    }

    // Explicitly pick only schema fields — never spread req.body directly,
    // as unknown keys (e.g. the frontend's `id` field) can conflict with
    // Mongoose's built-in `id` virtual and cause a CastError on _id.
    const b = req.body;
    const submission = await Submission.create({
      clientId:      clientId || undefined,
      token:         b.token         ?? '',
      practicalId:   b.practicalId,
      mode:          b.mode,
      studentId:     req.user.id,           // always from JWT
      studentName:   b.studentName   || '',
      studentReg:    b.studentReg    ?? null,
      submittedAt:   b.submittedAt,
      durationSec:   Number(b.durationSec)  || 0,
      score10:       Number(b.score10)      || 0,
      scorePct:      Number(b.scorePct)     || 0,
      passCount:     Number(b.passCount)    || 0,
      totalSteps:    Number(b.totalSteps)   || 14,
      result:        b.result,
      ph:            Number(b.ph)           || 0,
      viscosity:     Number(b.viscosity)    || 0,
      stability:     b.stability     || 'unknown',
      synced:        true,
      submitterRole: req.user.role,
    });

    res.status(201).json({ submission });
  } catch (err) {
    console.error('Save submission error:', err);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

module.exports = router;
