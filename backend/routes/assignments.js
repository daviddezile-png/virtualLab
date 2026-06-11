const express         = require('express');
const { body, validationResult } = require('express-validator');
const Assignment      = require('../models/Assignment');
const User            = require('../models/User');
const AssignmentTimer = require('../models/AssignmentTimer');
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
    // Students must be assigned to a teacher before using assignment codes
    if (req.user.role === 'student') {
      const student = await User.findOne({ clientId: req.user.id })
        .select('assignedTeacherId');
      if (!student?.assignedTeacherId) {
        return res.status(403).json({
          error: 'You must join a class first. Ask your teacher for a class invitation code and enter it on the lab page.',
          noTeacher: true,
        });
      }

      const assignment = await Assignment.findOne({
        token: req.params.token.toUpperCase(),
      });

      if (!assignment)
        return res.status(404).json({ error: 'Invalid code — no assignment found' });

      // Enforce that the assignment belongs to the student's assigned teacher
      if (assignment.teacherId !== student.assignedTeacherId) {
        return res.status(403).json({
          error: 'This assignment code was not issued by your teacher. Ask your teacher for the correct code.',
        });
      }

      if (assignment.codeExpiresAt && new Date() > new Date(assignment.codeExpiresAt))
        return res.status(410).json({ error: 'This assignment code has expired' });

      if (assignment.maxUses > 0 && assignment.useCount >= assignment.maxUses)
        return res.status(410).json({ error: 'This code has reached its maximum number of uses' });

      // Find or create this student's personal timer for this assignment.
      // upsert with setOnInsert ensures startedAt is only written on first redemption.
      const now = new Date();
      const timerDoc = await AssignmentTimer.findOneAndUpdate(
        { studentId: req.user.id, token: assignment.token },
        { $setOnInsert: { studentId: req.user.id, token: assignment.token,
            practicalId: assignment.practicalId, startedAt: now } },
        { upsert: true, new: true }
      );

      // Only increment useCount on the very first redemption by this student
      if (timerDoc.startedAt.getTime() === now.getTime()) {
        assignment.useCount += 1;
        await assignment.save();
      }

      return res.json({
        assignment,
        startedAt: timerDoc.startedAt.getTime(), // ms timestamp — authoritative timer start
      });
    }

    // Non-students (teachers previewing, admins) — no teacher-check
    const assignment = await Assignment.findOne({
      token: req.params.token.toUpperCase(),
    });

    if (!assignment)
      return res.status(404).json({ error: 'Invalid code — no assignment found' });

    if (assignment.codeExpiresAt && new Date() > new Date(assignment.codeExpiresAt))
      return res.status(410).json({ error: 'This assignment code has expired' });

    if (assignment.maxUses > 0 && assignment.useCount >= assignment.maxUses)
      return res.status(410).json({ error: 'This code has reached its maximum number of uses' });

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
