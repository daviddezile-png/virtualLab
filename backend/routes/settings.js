const express  = require('express');
const { body, validationResult } = require('express-validator');
const Settings = require('../models/Settings');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/settings/public ── no auth ───────────────────────────────────────
// Used by the login/registration screens to know whether registration is open
// or the platform is in maintenance, before a token exists.
router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    res.json({ settings: settings.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Everything below requires a valid token.
router.use(authenticate);

// ── GET /api/settings ── admin only — full configuration ──────────────────────
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    res.json({ settings: settings.toAdminJSON() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ── PATCH /api/settings ── admin only — update configuration ──────────────────
router.patch('/', requireRole('admin'), [
  body('maintenanceMode').optional().isBoolean(),
  body('openRegistration').optional().isBoolean(),
  body('maxStudents').optional().isInt({ min: 1 }),
  body('adminInviteCode').optional().isString().trim().isLength({ min: 4 })
    .withMessage('Admin invite code must be at least 4 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });

  try {
    const settings = await Settings.getSingleton();
    const fields = ['maintenanceMode', 'openRegistration', 'maxStudents', 'adminInviteCode'];
    for (const f of fields) {
      if (req.body[f] !== undefined) settings[f] = req.body[f];
    }
    settings.updatedBy = req.user.email || req.user.id;
    await settings.save();
    res.json({ settings: settings.toAdminJSON() });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
