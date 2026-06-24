const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Settings — a single global configuration document ("singleton").
// We pin it to a fixed _id ("global") so there is never more than one row and
// reads/writes never need to guess which document to touch.
// ─────────────────────────────────────────────────────────────────────────────
const settingsSchema = new mongoose.Schema(
  {
    _id: {
      type:    String,
      default: 'global',
    },
    // When true, only admins can use the platform; everyone else sees a notice.
    maintenanceMode: {
      type:    Boolean,
      default: false,
    },
    // When false, self-registration is closed (admins can still create accounts).
    openRegistration: {
      type:    Boolean,
      default: true,
    },
    // Soft cap on the number of active student accounts.
    maxStudents: {
      type:    Number,
      default: 500,
      min:     1,
    },
    // Secret code required to create admin accounts via self-registration.
    adminInviteCode: {
      type:    String,
      default: 'VLAB-ADMIN-2026',
      trim:    true,
    },
    // Who last changed the settings (for the audit trail / display).
    updatedBy: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true, _id: false }
);

// Fetch the singleton, creating it with defaults on first access.
settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findById('global');
  if (!doc) doc = await this.create({ _id: 'global' });
  return doc;
};

// Public view — never leak the admin invite code to non-admins.
settingsSchema.methods.toPublicJSON = function () {
  return {
    maintenanceMode:  this.maintenanceMode,
    openRegistration: this.openRegistration,
    maxStudents:      this.maxStudents,
    updatedAt:        this.updatedAt,
  };
};

// Admin view — full configuration including the invite code.
settingsSchema.methods.toAdminJSON = function () {
  return {
    maintenanceMode:  this.maintenanceMode,
    openRegistration: this.openRegistration,
    maxStudents:      this.maxStudents,
    adminInviteCode:  this.adminInviteCode,
    updatedBy:        this.updatedBy,
    updatedAt:        this.updatedAt,
  };
};

module.exports = mongoose.model('Settings', settingsSchema);
