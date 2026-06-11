const mongoose = require('mongoose');

// Stores the exact moment each student first redeemed an assignment code.
// This is the authoritative per-student timer start — never reset by the client.
const assignmentTimerSchema = new mongoose.Schema(
  {
    studentId:   { type: String, required: true },  // student clientId from JWT
    token:       { type: String, required: true },  // assignment token e.g. VC-ABC123
    practicalId: { type: String, required: true },
    startedAt:   { type: Date,   required: true },  // when this student first redeemed
  },
  { timestamps: true }
);

// One timer record per (student, token) pair
assignmentTimerSchema.index({ studentId: 1, token: 1 }, { unique: true });
assignmentTimerSchema.index({ token: 1 });

module.exports = mongoose.model('AssignmentTimer', assignmentTimerSchema);
