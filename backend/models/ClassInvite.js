const mongoose = require('mongoose');

const classInviteSchema = new mongoose.Schema(
  {
    token: {
      type:      String,
      required:  true,
      unique:    true,
      trim:      true,
      uppercase: true,
    },
    teacherId: {
      type:     String,
      required: true,
    },
    teacherName: {
      type:    String,
      default: '',
    },
    // Human-readable class name, e.g. "Biology Yr1 2026". The token is the
    // enrollment code students redeem to join this class.
    name: {
      type:    String,
      required: true,
      trim:    true,
    },
    // Optional academic year/term label for grouping (e.g. 2026).
    year: {
      type:    String,
      default: '',
      trim:    true,
    },
    // Archived classes (e.g. graduated cohorts) stay for historical analytics
    // but no longer accept new enrollments and are hidden by default.
    archived: {
      type:    Boolean,
      default: false,
    },
    useCount: {
      type:    Number,
      default: 0,
      min:     0,
    },
  },
  { timestamps: true }
);

classInviteSchema.index({ token:     1 });
classInviteSchema.index({ teacherId: 1 });
classInviteSchema.index({ archived:  1 });

module.exports = mongoose.model('ClassInvite', classInviteSchema);
