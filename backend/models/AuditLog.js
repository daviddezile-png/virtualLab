const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  'user_registered', 'user_login', 'user_deleted',
  'lab_started', 'lab_evaluated', 'code_entered', 'lab_milestone',
  'assignment_created', 'assignment_deleted',
  'question_created', 'question_deleted',
  'announcement_sent',
  'qa_submitted',
  'admin_action',
];

const auditLogSchema = new mongoose.Schema(
  {
    // Frontend-generated ID (for idempotency)
    clientId: {
      type:   String,
      unique: true,
      sparse: true,
    },
    action: {
      type:     String,
      required: true,
      enum:     AUDIT_ACTIONS,
    },
    actorId: {
      type:     String,
      required: true,
    },
    actorName: {
      type:     String,
      required: true,
    },
    actorRole: {
      type:     String,
      required: true,
    },
    detail: {
      type:     String,
      required: true,
    },
    // Original client-side timestamp
    clientTimestamp: {
      type:    Date,
      default: Date.now,
    },
  },
  { timestamps: true }   // createdAt = server receipt time
);

// ── Indexes ───────────────────────────────────────────────────────────────────
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorRole: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
