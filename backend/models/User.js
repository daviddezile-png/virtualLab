const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // Human-readable unique ID used by the frontend (e.g. "u1716000000-abc12")
    clientId: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
    },
    role: {
      type:     String,
      enum:     ['admin', 'teacher', 'student'],
      required: true,
    },
    fullName: {
      type:     String,
      required: true,
      trim:     true,
    },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    // Only students have a registration number
    regNumber: {
      type:    String,
      trim:    true,
      default: null,
    },
    passwordHash: {
      type:     String,
      required: true,
    },
    status: {
      type:    String,
      enum:    ['active', 'pending', 'rejected'],
      default: 'active',
    },
    suspended: {
      type:    Boolean,
      default: false,
    },
    // true = seeded default admin, cannot be deleted
    seeded: {
      type:    Boolean,
      default: false,
    },
    lastLogin: {
      type:    Date,
      default: null,
    },
    // Students only — the teacher they joined via invitation code
    assignedTeacherId: {
      type:    String,
      default: null,
    },
    assignedTeacherName: {
      type:    String,
      default: null,
    },
    // Students only — the specific class they enrolled into (a ClassInvite _id).
    // A student belongs to one class at a time; redeeming a new class code moves
    // them. The teacher is always derivable from the class.
    assignedClassId: {
      type:    String,
      default: null,
    },
    assignedClassName: {
      type:    String,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ clientId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// ── Helpers ───────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

userSchema.statics.hashPassword = async (plaintext) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plaintext, salt);
};

module.exports = mongoose.model('User', userSchema);
