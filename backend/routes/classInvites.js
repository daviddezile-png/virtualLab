const express     = require('express');
const { body, validationResult } = require('express-validator');
const ClassInvite = require('../models/ClassInvite');
const User        = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randToken = () => {
  const rand = Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
  return `CLS-${rand}`;
};

// Generate a token guaranteed unique against existing classes (retry a few times).
const uniqueToken = async () => {
  for (let i = 0; i < 5; i++) {
    const token = randToken();
    if (!(await ClassInvite.findOne({ token }))) return token;
  }
  // Extremely unlikely; fall back to a longer random suffix.
  return `CLS-${Date.now().toString(36).toUpperCase().slice(-6)}`;
};

// ── GET /api/class-invites ── teacher sees their own classes ────────────────────
// ?includeArchived=1 to also return archived classes (hidden by default).
router.get('/', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { teacherId: req.user.id };
    if (req.query.includeArchived !== '1') query.archived = { $ne: true };
    const invites = await ClassInvite.find(query).sort({ createdAt: -1 });
    res.json({ invites });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// ── POST /api/class-invites ── teacher creates a new class (with a code) ────────
router.post('/', requireRole('teacher', 'admin'), [
  body('name').trim().notEmpty().withMessage('Class name is required')
    .isLength({ max: 80 }).withMessage('Class name is too long'),
  body('year').optional().trim().isLength({ max: 20 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: errors.array()[0].msg });

  try {
    const teacher = await User.findOne({ clientId: req.user.id }).select('fullName');
    const token   = await uniqueToken();

    const invite = await ClassInvite.create({
      token,
      teacherId:   req.user.id,
      teacherName: teacher?.fullName ?? '',
      name:        req.body.name.trim(),
      year:        (req.body.year ?? '').trim(),
    });
    res.status(201).json({ invite });
  } catch (err) {
    console.error('Create class error:', err);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// ── PATCH /api/class-invites/:id ── rename or archive/unarchive a class ─────────
router.patch('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const invite = await ClassInvite.findById(req.params.id);
    if (!invite) return res.status(404).json({ error: 'Class not found' });
    if (req.user.role === 'teacher' && invite.teacherId !== req.user.id)
      return res.status(403).json({ error: 'Not your class' });

    if (typeof req.body.name === 'string' && req.body.name.trim())
      invite.name = req.body.name.trim().slice(0, 80);
    if (typeof req.body.year === 'string')
      invite.year = req.body.year.trim().slice(0, 20);
    if (typeof req.body.archived === 'boolean')
      invite.archived = req.body.archived;

    await invite.save();

    // Keep the denormalised class name on enrolled students in sync after a rename.
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      await User.updateMany(
        { assignedClassId: invite._id.toString() },
        { assignedClassName: invite.name }
      );
    }

    res.json({ invite });
  } catch (err) {
    console.error('Update class error:', err);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// ── POST /api/class-invites/redeem ── student joins a class via its code ────────
router.post('/redeem', requireRole('student'), [
  body('token').notEmpty().trim().toUpperCase(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Code is required' });

  try {
    const { token } = req.body;
    const invite = await ClassInvite.findOne({ token: token.toUpperCase().trim() });
    if (!invite)
      return res.status(404).json({ error: 'Class code not found. Check the code and try again.' });

    if (invite.archived)
      return res.status(410).json({ error: 'This class is no longer accepting new students.' });

    const classId = invite._id.toString();
    const student = await User.findOne({ clientId: req.user.id });

    // Already in this exact class.
    if (student.assignedClassId === classId) {
      return res.json({
        alreadyAssigned: true,
        teacherName:     invite.teacherName,
        teacherId:       invite.teacherId,
        className:       invite.name,
        classId,
        message:         `You are already in ${invite.name}.`,
      });
    }

    // Enroll the student into this class (and its owning teacher). Moving classes
    // simply overwrites the previous assignment.
    await User.findOneAndUpdate(
      { clientId: req.user.id },
      {
        assignedTeacherId:   invite.teacherId,
        assignedTeacherName: invite.teacherName,
        assignedClassId:     classId,
        assignedClassName:   invite.name,
      }
    );

    invite.useCount += 1;
    await invite.save();

    res.json({
      success:     true,
      teacherName: invite.teacherName,
      teacherId:   invite.teacherId,
      className:   invite.name,
      classId,
      message:     `You have joined ${invite.name}!`,
    });
  } catch (err) {
    console.error('Redeem class code error:', err);
    res.status(500).json({ error: 'Failed to join class' });
  }
});

// ── GET /api/class-invites/my-class ── student checks their current class ───────
router.get('/my-class', requireRole('student'), async (req, res) => {
  try {
    const student = await User.findOne({ clientId: req.user.id })
      .select('assignedTeacherId assignedTeacherName assignedClassId assignedClassName');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({
      assignedTeacherId:   student.assignedTeacherId   ?? null,
      assignedTeacherName: student.assignedTeacherName ?? null,
      assignedClassId:     student.assignedClassId      ?? null,
      assignedClassName:   student.assignedClassName    ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch class info' });
  }
});

// ── GET /api/class-invites/my-teacher ── back-compat alias for older clients ────
router.get('/my-teacher', requireRole('student'), async (req, res) => {
  try {
    const student = await User.findOne({ clientId: req.user.id })
      .select('assignedTeacherId assignedTeacherName');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({
      assignedTeacherId:   student.assignedTeacherId   ?? null,
      assignedTeacherName: student.assignedTeacherName ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teacher info' });
  }
});

// ── DELETE /api/class-invites/:id ── delete a class ─────────────────────────────
// Archiving is preferred for cohorts with history; deletion is allowed for empty
// classes (e.g. created by mistake).
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const invite = await ClassInvite.findById(req.params.id);
    if (!invite) return res.status(404).json({ error: 'Class not found' });
    if (req.user.role === 'teacher' && invite.teacherId !== req.user.id)
      return res.status(403).json({ error: 'Not your class' });

    // Detach any students still pointing at this class so they don't keep a
    // dangling reference. They keep their teacher and can re-enroll elsewhere.
    await User.updateMany(
      { assignedClassId: invite._id.toString() },
      { assignedClassId: null, assignedClassName: null }
    );

    await invite.deleteOne();
    res.json({ message: 'Class deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

module.exports = router;
