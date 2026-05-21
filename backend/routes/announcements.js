const express      = require('express');
const { body, validationResult } = require('express-validator');
const Announcement = require('../models/Announcement');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/announcements ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ── POST /api/announcements ───────────────────────────────────────────────────
router.post('/', requireRole('teacher', 'admin'), [
  body('title').notEmpty().trim(),
  body('body').notEmpty().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const ann = await Announcement.create({
      ...req.body,
      authorId:   req.user.id,
      authorName: req.body.authorName || '',
    });
    res.status(201).json({ announcement: ann });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// ── DELETE /api/announcements/:id ─────────────────────────────────────────────
router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });
    await ann.deleteOne();
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
