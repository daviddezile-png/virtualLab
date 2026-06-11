const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    // Frontend-generated ID (kept for idempotent saves)
    clientId: {
      type:   String,
      unique: true,
      sparse: true,
    },
    token: {
      type:    String,
      default: '',
    },
    practicalId: {
      type:     String,
      required: true,
      enum:     ['vanishing-cream', 'cold-cream'],
    },
    mode: {
      type:     String,
      required: true,
      enum:     ['assignment', 'practice'],
    },
    studentId: {
      type:     String,
      required: true,
      ref:      'User',
    },
    studentName: {
      type:    String,
      default: 'Anonymous',
    },
    studentReg: {
      type:    String,
      default: null,
    },
    submittedAt: {
      type:     Date,
      required: true,
    },
    durationSec: {
      type:    Number,
      default: 0,
    },
    // Score out of 10
    score10: {
      type:    Number,
      default: 0,
      min:     0,
      max:     10,
    },
    // Score as a percentage (0–100)
    scorePct: {
      type:    Number,
      default: 0,
      min:     0,
      max:     100,
    },
    passCount: {
      type:    Number,
      default: 0,
    },
    totalSteps: {
      type:    Number,
      default: 14,
    },
    result: {
      type:     String,
      enum:     ['PASS', 'AVERAGE', 'FAIL'],
      required: true,
    },
    ph: {
      type:    Number,
      default: 0,
    },
    viscosity: {
      type:    Number,
      default: 0,
    },
    stability: {
      type:    String,
      default: 'unknown',
    },
    synced: {
      type:    Boolean,
      default: true,
    },
    // Stored at save time so teacher queries can filter out non-student rows
    submitterRole: {
      type:    String,
      enum:    ['student', 'teacher', 'admin'],
      default: 'student',
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
submissionSchema.index({ studentId: 1 });
submissionSchema.index({ practicalId: 1 });
submissionSchema.index({ token: 1 });
submissionSchema.index({ result: 1 });
submissionSchema.index({ submittedAt: -1 });
submissionSchema.index({ mode: 1 });
submissionSchema.index({ submitterRole: 1 });

// ── Aggregate helpers ─────────────────────────────────────────────────────────
submissionSchema.statics.getStats = async function () {
  const [agg] = await this.aggregate([
    {
      $group: {
        _id:          null,
        total:        { $sum: 1 },
        avgScore:     { $avg: '$scorePct' },
        passCount:    { $sum: { $cond: [{ $eq: ['$result', 'PASS'] },    1, 0] } },
        averageCount: { $sum: { $cond: [{ $eq: ['$result', 'AVERAGE'] }, 1, 0] } },
        failCount:    { $sum: { $cond: [{ $eq: ['$result', 'FAIL'] },    1, 0] } },
      },
    },
  ]);
  if (!agg) return { total: 0, avgScore: 0, passCount: 0, averageCount: 0, failCount: 0 };
  agg.avgScore = Math.round(agg.avgScore * 10) / 10;
  delete agg._id;
  return agg;
};

module.exports = mongoose.model('Submission', submissionSchema);
