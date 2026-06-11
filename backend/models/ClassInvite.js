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

module.exports = mongoose.model('ClassInvite', classInviteSchema);
