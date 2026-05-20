const mongoose = require('mongoose');

const qaQuestionSchema = new mongoose.Schema(
  {
    // Frontend-generated ID
    clientId: {
      type:   String,
      unique: true,
      sparse: true,
    },
    practicalId: {
      type:     String,
      required: true,
      enum:     ['vanishing-cream', 'cold-cream'],
    },
    type: {
      type:     String,
      enum:     ['mcq', 'short'],
      default:  'mcq',
    },
    question: {
      type:     String,
      required: true,
      trim:     true,
    },
    options: {
      type:    [String],
      default: [],
    },
    // Index of the correct option (MCQ only)
    correctAnswer: {
      type:    Number,
      default: null,
    },
    points: {
      type:    Number,
      default: 1,
      min:     0,
    },
    createdBy: {
      type:    String,
      default: '',
      ref:     'User',
    },
  },
  { timestamps: true }
);

qaQuestionSchema.index({ practicalId: 1 });
qaQuestionSchema.index({ type: 1 });
qaQuestionSchema.index({ createdBy: 1 });

module.exports = mongoose.model('QAQuestion', qaQuestionSchema);
