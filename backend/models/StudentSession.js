const mongoose = require('mongoose');

const studentSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  studentId: {
    type: String,
    required: true,
    ref: 'Student',
    trim: true
  },
  simulationType: {
    type: String,
    required: true,
    enum: ['vanishing_cream'],
    default: 'vanishing_cream'
  },
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Performance metrics
  stepsCompleted: {
    type: Number,
    default: 0
  },
  totalErrors: {
    type: Number,
    default: 0
  },
  criticalErrors: {
    type: Number,
    default: 0
  },
  totalTime: {
    type: Number,
    default: 0 // in milliseconds
  },
  totalActions: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  feedback: {
    type: [String],
    default: []
  },
  // Step-specific data
  stepData: {
    selection: {
      ingredientsSelected: Number,
      timeSpent: Number,
      errors: Number
    },
    heating: {
      targetTempReached: Boolean,
      timeSpent: Number,
      errors: Number
    },
    emulsification: {
      temperatureDifference: Number,
      timeSpent: Number,
      errors: Number
    },
    cooling: {
      finalTempReached: Boolean,
      timeSpent: Number,
      errors: Number
    },
    evaluation: {
      finalScore: Number,
      timeSpent: Number,
      errors: Number
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
studentSessionSchema.index({ sessionId: 1 });
studentSessionSchema.index({ studentId: 1 });
studentSessionSchema.index({ isActive: 1 });
studentSessionSchema.index({ startTime: -1 });
studentSessionSchema.index({ simulationType: 1 });
studentSessionSchema.index({ isCompleted: 1 });
studentSessionSchema.index({ score: -1 });

// Pre-save middleware to update timestamps
studentSessionSchema.pre('save', function(next) {
  if (this.isModified('lastActivity') === false) {
    this.lastActivity = new Date();
  }
  next();
});

// Static method to find active sessions
studentSessionSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true });
};

// Static method to find completed sessions
studentSessionSchema.statics.findCompleted = function(filter = {}) {
  return this.find({ ...filter, isCompleted: true });
};

// Method to calculate session duration
studentSessionSchema.methods.getDuration = function() {
  const endTime = this.endTime || new Date();
  return endTime.getTime() - this.startTime.getTime();
};

// Method to calculate average score for a student
studentSessionSchema.statics.getAverageScore = async function(studentId) {
  const result = await this.aggregate([
    { $match: { studentId, isCompleted: true } },
    {
      $group: {
        _id: null,
        averageScore: { $avg: '$score' },
        totalSessions: { $sum: 1 }
      }
    }
  ]);
  
  return result.length > 0 ? result[0] : { averageScore: 0, totalSessions: 0 };
};

// Method to get class performance statistics
studentSessionSchema.statics.getClassStats = async function(classId, startDate, endDate) {
  const Student = mongoose.model('Student');
  
  // Get all students in the class
  const students = await Student.find({ classId, isActive: true }).select('studentId');
  const studentIds = students.map(s => s.studentId);
  
  // Build date filter
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  
  const matchStage = {
    studentId: { $in: studentIds },
    isCompleted: true
  };
  
  if (Object.keys(dateFilter).length > 0) {
    matchStage.startTime = dateFilter;
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        averageScore: { $avg: '$score' },
        averageTime: { $avg: '$totalTime' },
        totalErrors: { $sum: '$totalErrors' },
        criticalErrors: { $sum: '$criticalErrors' }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalSessions: 0,
    averageScore: 0,
    averageTime: 0,
    totalErrors: 0,
    criticalErrors: 0
  };
};

module.exports = mongoose.model('StudentSession', studentSessionSchema);
