const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    token: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
      uppercase: true,
    },
    practicalId: {
      type:     String,
      required: true,
      enum:     ['vanishing-cream', 'cold-cream'],
    },
    // Teacher who created it (clientId from User)
    teacherId: {
      type:     String,
      required: true,
      ref:      'User',
    },
    teacherName: {
      type:  String,
      default: '',
    },
    targetGrams: {
      type:    Number,
      default: 100,
      min:     1,
    },
    timeLimitMinutes: {
      type:    Number,
      default: 0,   // 0 = no limit
      min:     0,
    },
    // ISO string when the code can no longer be redeemed
    codeExpiresAt: {
      type:    Date,
      default: null,
    },
    maxUses: {
      type:    Number,
      default: 0,   // 0 = unlimited
      min:     0,
    },
    useCount: {
      type:    Number,
      default: 0,
      min:     0,
    },
    notes: {
      type:    String,
      default: '',
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
assignmentSchema.index({ token: 1 });
assignmentSchema.index({ teacherId: 1 });
assignmentSchema.index({ practicalId: 1 });
assignmentSchema.index({ codeExpiresAt: 1 });

// ── Helpers ───────────────────────────────────────────────────────────────────
assignmentSchema.virtual('isExpired').get(function () {
  if (!this.codeExpiresAt) return false;
  return new Date() > new Date(this.codeExpiresAt);
});

module.exports = mongoose.model('Assignment', assignmentSchema);
