const mongoose = require('mongoose');

const telemetryLogSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    ref: 'StudentSession',
    trim: true
  },
  studentId: {
    type: String,
    required: true,
    ref: 'Student',
    trim: true
  },
  eventId: {
    type: String,
    required: true,
    trim: true
  },
  eventType: {
    type: String,
    required: true,
    enum: ['step_start', 'step_complete', 'error', 'action', 'temperature_change']
  },
  step: {
    type: String,
    enum: ['selection', 'heating', 'emulsification', 'cooling', 'evaluation']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  duration: {
    type: Number,
    default: null // in milliseconds
  },
  clientTimestamp: {
    type: Date,
    required: true
  },
  serverTimestamp: {
    type: Date,
    default: Date.now
  },
  clientRequestTimestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
telemetryLogSchema.index({ sessionId: 1 });
telemetryLogSchema.index({ studentId: 1 });
telemetryLogSchema.index({ eventType: 1 });
telemetryLogSchema.index({ step: 1 });
telemetryLogSchema.index({ serverTimestamp: -1 });
telemetryLogSchema.index({ clientTimestamp: -1 });
telemetryLogSchema.index({ eventId: 1 });
telemetryLogSchema.index({ 'data.type': 1 });
telemetryLogSchema.index({ 'data.severity': 1 });

// Compound indexes for complex queries
telemetryLogSchema.index({ sessionId: 1, eventType: 1 });
telemetryLogSchema.index({ studentId: 1, serverTimestamp: -1 });
telemetryLogSchema.index({ eventType: 1, step: 1 });

// Static method to find logs by session with pagination
telemetryLogSchema.statics.findBySession = function(sessionId, options = {}) {
  const {
    limit = 100,
    offset = 0,
    eventType,
    sortBy = 'serverTimestamp',
    sortOrder = -1
  } = options;

  const query = { sessionId };
  if (eventType) {
    query.eventType = eventType;
  }

  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(offset);
};

// Static method to find error logs
telemetryLogSchema.statics.findErrors = function(options = {}) {
  const {
    studentId,
    sessionId,
    severity,
    limit = 50,
    offset = 0
  } = options;

  const query = { eventType: 'error' };
  
  if (studentId) query.studentId = studentId;
  if (sessionId) query.sessionId = sessionId;
  if (severity) query['data.severity'] = severity;

  return this.find(query)
    .sort({ serverTimestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get event statistics
telemetryLogSchema.statics.getEventStats = function(filter = {}) {
  return this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          step: '$step'
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        totalDuration: { $sum: '$duration' },
        firstOccurrence: { $min: '$serverTimestamp' },
        lastOccurrence: { $max: '$serverTimestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.eventType',
        steps: {
          $push: {
            step: '$_id.step',
            count: '$count',
            avgDuration: '$avgDuration',
            totalDuration: '$totalDuration'
          }
        },
        totalCount: { $sum: '$count' },
        overallAvgDuration: { $avg: '$avgDuration' },
        overallTotalDuration: { $sum: '$totalDuration' }
      }
    },
    { $sort: { totalCount: -1 } }
  ]);
};

// Static method to get error analysis
telemetryLogSchema.statics.getErrorAnalysis = function(filter = {}) {
  return this.aggregate([
    { $match: { ...filter, eventType: 'error' } },
    {
      $group: {
        _id: {
          errorType: '$data.type',
          severity: '$data.severity',
          step: '$step'
        },
        count: { $sum: 1 },
        affectedStudents: { $addToSet: '$studentId' },
        affectedSessions: { $addToSet: '$sessionId' },
        firstOccurrence: { $min: '$serverTimestamp' },
        lastOccurrence: { $max: '$serverTimestamp' }
      }
    },
    {
      $project: {
        errorType: '$_id.errorType',
        severity: '$_id.severity',
        step: '$_id.step',
        count: 1,
        affectedStudentCount: { $size: '$affectedStudents' },
        affectedSessionCount: { $size: '$affectedSessions' },
        firstOccurrence: 1,
        lastOccurrence: 1,
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Static method to get student activity timeline
telemetryLogSchema.statics.getStudentTimeline = function(studentId, options = {}) {
  const {
    startDate,
    endDate,
    limit = 200,
    offset = 0
  } = options;

  const matchStage = { studentId };
  
  if (startDate || endDate) {
    matchStage.serverTimestamp = {};
    if (startDate) matchStage.serverTimestamp.$gte = new Date(startDate);
    if (endDate) matchStage.serverTimestamp.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$serverTimestamp' } },
          eventType: '$eventType'
        },
        count: { $sum: 1 },
        events: { $push: '$$ROOT' }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        eventTypes: {
          $push: {
            eventType: '$_id.eventType',
            count: '$count'
          }
        },
        totalEvents: { $sum: '$count' },
        sampleEvents: { $slice: ['$events', 5] }
      }
    },
    { $sort: { _id: -1 } },
    { $skip: offset },
    { $limit: limit }
  ]);
};

// Instance method to check if it's a critical error
telemetryLogSchema.methods.isCriticalError = function() {
  return this.eventType === 'error' && 
         this.data && 
         this.data.severity === 'critical';
};

// Instance method to get human-readable description
telemetryLogSchema.methods.getDescription = function() {
  switch (this.eventType) {
    case 'step_start':
      return `Started ${this.step || 'unknown'} step`;
    case 'step_complete':
      return `Completed ${this.step || 'unknown'} step${this.duration ? ` in ${(this.duration / 1000).toFixed(1)}s` : ''}`;
    case 'error':
      return `Error in ${this.step || 'unknown'}: ${this.data?.message || 'Unknown error'}`;
    case 'action':
      return `Action: ${this.data?.action || 'Unknown action'} in ${this.step || 'unknown'}`;
    case 'temperature_change':
      return `Temperature change in ${this.data?.propertyId || 'unknown'}: ${this.data?.oldTemperature || 0}°C → ${this.data?.newTemperature || 0}°C`;
    default:
      return `${this.eventType} event`;
  }
};

module.exports = mongoose.model('TelemetryLog', telemetryLogSchema);
