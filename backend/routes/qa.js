const express    = require('express');
const { body, validationResult } = require('express-validator');
const QAQuestion = require('../models/QAQuestion');
const QAAnswer   = require('../models/QAAnswer');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/qa/questions ─────────────────────────────────────────────────────
router.get('/questions', async (req, res) => {
  try {
    const { practicalId } = req.query;
    const query = practicalId ? { practicalId } : {};
    const questions = await QAQuestion.find(query).sort({ createdAt: 1 });
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// ── POST /api/qa/questions ── teacher/admin creates a question ────────────────
router.post('/questions', requireRole('teacher', 'admin'), [
  body('practicalId').isIn(['vanishing-cream', 'cold-cream']),
  body('question').notEmpty().trim(),
  body('type').isIn(['mcq', 'short']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const question = await QAQuestion.create({
      ...req.body,
      createdBy: req.user.id,
    });
    res.status(201).json({ question });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// ── DELETE /api/qa/questions/:id ──────────────────────────────────────────────
router.delete('/questions/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const q = await QAQuestion.findById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    await q.deleteOne();
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ── GET /api/qa/answers ───────────────────────────────────────────────────────
router.get('/answers', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { practicalId, studentId } = req.query;
    const query = {};
    if (practicalId) query.practicalId = practicalId;
    if (studentId)   query.studentId   = studentId;
    const answers = await QAAnswer.find(query).sort({ submittedAt: -1 });
    res.json({ answers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch answers' });
  }
});

// ── POST /api/qa/answers ── student submits answers ───────────────────────────
router.post('/answers', [
  body('answers').isArray({ min: 1 }),
  body('practicalId').isIn(['vanishing-cream', 'cold-cream']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const { practicalId, answers, submissionId, studentName } = req.body;

    const saved = await Promise.all(answers.map(async (a) => {
      if (a.clientId) {
        const existing = await QAAnswer.findOne({ clientId: a.clientId });
        if (existing) return existing;
      }
      return QAAnswer.create({
        ...a,
        practicalId,
        studentId:   req.user.id,
        studentName: studentName || '',
        submissionId: submissionId || null,
        submittedAt:  new Date(),
      });
    }));

    res.status(201).json({ answers: saved });
  } catch (err) {
    console.error('Submit answers error:', err);
    res.status(500).json({ error: 'Failed to submit answers' });
  }
});

// ── PATCH /api/qa/answers/:id/mark ── teacher marks short answer ──────────────
router.patch('/answers/:id/mark', requireRole('teacher', 'admin'), [
  body('isCorrect').isBoolean(),
  body('pointsAwarded').isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const answer = await QAAnswer.findByIdAndUpdate(
      req.params.id,
      { isCorrect: req.body.isCorrect, pointsAwarded: req.body.pointsAwarded },
      { new: true }
    );
    if (!answer) return res.status(404).json({ error: 'Answer not found' });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark answer' });
  }
});

module.exports = router;
