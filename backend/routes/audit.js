const express  = require('express');
const { body, validationResult } = require('express-validator');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/audit ── admin only ──────────────────────────────────────────────
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { action, actorId, search, limit = 200, offset = 0 } = req.query;
    const query = {};
    if (action)  query.action  = action;
    if (actorId) query.actorId = actorId;
    if (search) {
      query.$or = [
        { actorName: { $regex: search, $options: 'i' } },
        { detail:    { $regex: search, $options: 'i' } },
      ];
    }
    const docs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    // Shape each row to the contract the frontend expects: a stable `id` and a
    // single `timestamp` (the client-side time if present, else server receipt).
    const logs = docs.map(d => ({
      id:        d.clientId || String(d._id),
      action:    d.action,
      actorId:   d.actorId,
      actorName: d.actorName,
      actorRole: d.actorRole,
      detail:    d.detail,
      timestamp: (d.clientTimestamp || d.createdAt).toISOString(),
    }));
    const total = await AuditLog.countDocuments(query);
    res.json({ logs, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ── POST /api/audit ── any authenticated user can push entries ────────────────
router.post('/', [
  body('action').notEmpty(),
  body('actorId').notEmpty(),
  body('actorName').notEmpty(),
  body('actorRole').notEmpty(),
  body('detail').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const { clientId } = req.body;
    if (clientId) {
      const existing = await AuditLog.findOne({ clientId });
      if (existing) return res.status(200).json({ log: existing });
    }

    const log = await AuditLog.create({
      ...req.body,
      clientTimestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
    });
    res.status(201).json({ log });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save audit entry' });
  }
});

// ── POST /api/audit/batch ── bulk-push entries ────────────────────────────────
router.post('/batch', [
  body('entries').isArray({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const { entries } = req.body;
    const ops = entries.map(e => ({
      updateOne: {
        filter: { clientId: e.id },
        update: { $setOnInsert: { ...e, clientId: e.id, clientTimestamp: new Date(e.timestamp) } },
        upsert: true,
      },
    }));
    const result = await AuditLog.bulkWrite(ops);
    res.status(201).json({ inserted: result.upsertedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch-save audit entries' });
  }
});

// ── DELETE /api/audit ── clear all logs (admin only) ─────────────────────────
router.delete('/', requireRole('admin'), async (req, res) => {
  try {
    await AuditLog.deleteMany({});
    res.json({ message: 'Audit log cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear audit log' });
  }
});

module.exports = router;
