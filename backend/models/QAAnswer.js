const mongoose = require('mongoose');

const qaAnswerSchema = new mongoose.Schema(
  {
    clientId: {
      type:   String,
      unique: true,
      sparse: true,
    },
    questionId: {
      type:     String,
      required: true,
      ref:      'QAQuestion',
    },
    practicalId: {
      type:     String,
      required: true,
      enum:     ['vanishing-cream', 'cold-cream'],
    },
    studentId: {
      type:     String,
      required: true,
      ref:      'User',
    },
    studentName: {
      type:    String,
      default: '',
    },
    // The answer the student gave (option index for MCQ, text for short)
    answer: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
    // null = pending review, true = correct, false = wrong
    isCorrect: {
      type:    Boolean,
      default: null,
    },
    pointsAwarded: {
      type:    Number,
      default: 0,
    },
    // Link to a submission if one exists
    submissionId: {
      type:    String,
      default: null,
    },
    submittedAt: {
      type:    Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

qaAnswerSchema.index({ questionId: 1 });
qaAnswerSchema.index({ studentId: 1 });
qaAnswerSchema.index({ practicalId: 1 });
qaAnswerSchema.index({ submissionId: 1 });

module.exports = mongoose.model('QAAnswer', qaAnswerSchema);
