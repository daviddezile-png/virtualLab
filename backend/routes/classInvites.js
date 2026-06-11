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

// ── GET /api/class-invites ── teacher sees their own invite codes ──────────────
router.get('/', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { teacherId: req.user.id };
    const invites = await ClassInvite.find(query).sort({ createdAt: -1 });
    res.json({ invites });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// ── POST /api/class-invites ── teacher generates a new invite code ─────────────
router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const teacher = await User.findOne({ clientId: req.user.id }).select('fullName');
    let token = randToken();
    // Retry once on collision (very rare)
    if (await ClassInvite.findOne({ token })) token = randToken();

    const invite = await ClassInvite.create({
      token,
      teacherId:   req.user.id,
      teacherName: teacher?.fullName ?? '',
    });
    res.status(201).json({ invite });
  } catch (err) {
    console.error('Create class invite error:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// ── POST /api/class-invites/redeem ── student redeems an invite code ──────────
router.post('/redeem', requireRole('student'), [
  body('token').notEmpty().trim().toUpperCase(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Token is required' });

  try {
    const { token } = req.body;
    const invite = await ClassInvite.findOne({ token: token.toUpperCase().trim() });
    if (!invite)
      return res.status(404).json({ error: 'Invite code not found. Check the code and try again.' });

    const student = await User.findOne({ clientId: req.user.id });

    // Already in this teacher's class
    if (student.assignedTeacherId === invite.teacherId) {
      return res.json({
        alreadyAssigned: true,
        teacherName:     invite.teacherName,
        teacherId:       invite.teacherId,
        message:         `You are already in ${invite.teacherName}'s class.`,
      });
    }

    // Assign the teacher to this student
    await User.findOneAndUpdate(
      { clientId: req.user.id },
      { assignedTeacherId: invite.teacherId, assignedTeacherName: invite.teacherName }
    );

    invite.useCount += 1;
    await invite.save();

    res.json({
      success:     true,
      teacherName: invite.teacherName,
      teacherId:   invite.teacherId,
      message:     `You have been successfully added to ${invite.teacherName}'s class!`,
    });
  } catch (err) {
    console.error('Redeem invite error:', err);
    res.status(500).json({ error: 'Failed to redeem invite' });
  }
});

// ── GET /api/class-invites/my-teacher ── student checks their assigned teacher ─
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

// ── DELETE /api/class-invites/:id ── teacher deletes an invite code ───────────
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const invite = await ClassInvite.findById(req.params.id);
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (req.user.role === 'teacher' && invite.teacherId !== req.user.id)
      return res.status(403).json({ error: 'Not your invite' });
    await invite.deleteOne();
    res.json({ message: 'Invite deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invite' });
  }
});

module.exports = router;
