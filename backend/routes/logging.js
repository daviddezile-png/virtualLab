const express = require('express');
const { body, validationResult } = require('express-validator');
const StudentSession = require('../models/StudentSession');
const TelemetryLog = require('../models/TelemetryLog');

const router = express.Router();

// POST /api/log - Main telemetry endpoint
router.post('/', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('eventId').notEmpty().withMessage('Event ID is required'),
  body('eventType').isIn(['step_start', 'step_complete', 'error', 'action', 'temperature_change']).withMessage('Invalid event type'),
  body('step').optional().isIn(['selection', 'heating', 'emulsification', 'cooling', 'evaluation']).withMessage('Invalid step'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  body('duration').optional().isNumeric().withMessage('Duration must be numeric'),
  body('clientTimestamp').isISO8601().withMessage('Client timestamp must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      sessionId,
      studentId,
      eventId,
      eventType,
      step,
      data = {},
      duration,
      clientTimestamp
    } = req.body;

    // Verify session exists and belongs to student
    const session = await StudentSession.findOne({
      sessionId,
      studentId,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Active session does not exist or access denied'
      });
    }

    // Create telemetry log entry
    const telemetryLog = new TelemetryLog({
      sessionId,
      studentId,
      eventId,
      eventType,
      step,
      data,
      duration,
      clientTimestamp: new Date(clientTimestamp),
      clientRequestTimestamp: new Date()
    });

    await telemetryLog.save();

    // Update session metrics based on event type
    await updateSessionMetrics(session, telemetryLog);

    res.status(201).json({
      message: 'Telemetry event logged successfully',
      eventId: telemetryLog.eventId,
      timestamp: telemetryLog.serverTimestamp
    });

  } catch (error) {
    console.error('Telemetry logging error:', error);
    res.status(500).json({
      error: 'Telemetry logging failed',
      message: 'Internal server error'
    });
  }
});

// POST /api/log/batch - Batch telemetry logging
router.post('/batch', [
  body('events').isArray({ min: 1 }).withMessage('Events must be a non-empty array'),
  body('events.*.sessionId').notEmpty().withMessage('Session ID is required for each event'),
  body('events.*.studentId').notEmpty().withMessage('Student ID is required for each event'),
  body('events.*.eventId').notEmpty().withMessage('Event ID is required for each event'),
  body('events.*.eventType').isIn(['step_start', 'step_complete', 'error', 'action', 'temperature_change']).withMessage('Invalid event type for each event'),
  body('events.*.clientTimestamp').isISO8601().withMessage('Client timestamp must be a valid ISO 8601 date for each event')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { events } = req.body;

    // Group events by sessionId for efficient session lookup
    const sessionIds = [...new Set(events.map(event => event.sessionId))];
    const sessions = await StudentSession.find({
      sessionId: { $in: sessionIds },
      isActive: true
    });

    const sessionMap = new Map(sessions.map(session => [session.sessionId, session]));

    const telemetryLogs = [];
    const validationErrors = [];

    for (const eventData of events) {
      const { sessionId, studentId } = eventData;
      const session = sessionMap.get(sessionId);

      if (!session || session.studentId !== studentId) {
        validationErrors.push({
          eventId: eventData.eventId,
          error: 'Session not found or access denied'
        });
        continue;
      }

      const telemetryLog = new TelemetryLog({
        ...eventData,
        clientTimestamp: new Date(eventData.clientTimestamp),
        clientRequestTimestamp: new Date()
      });

      telemetryLogs.push(telemetryLog);
    }

    // Save all valid telemetry logs
    if (telemetryLogs.length > 0) {
      await TelemetryLog.insertMany(telemetryLogs);

      // Update session metrics for each unique session
      const affectedSessions = new Set();
      for (const log of telemetryLogs) {
        const session = sessionMap.get(log.sessionId);
        if (session && !affectedSessions.has(log.sessionId)) {
          await updateSessionMetrics(session, log);
          affectedSessions.add(log.sessionId);
        }
      }
    }

    res.status(201).json({
      message: 'Batch telemetry processed',
      logged: telemetryLogs.length,
      errors: validationErrors.length,
      errors: validationErrors
    });

  } catch (error) {
    console.error('Batch telemetry logging error:', error);
    res.status(500).json({
      error: 'Batch telemetry logging failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/log/session/:sessionId - Get logs for a specific session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      limit = 100, 
      offset = 0, 
      eventType, 
      sortBy = 'serverTimestamp',
      sortOrder = -1 
    } = req.query;

    // Verify session exists
    const session = await StudentSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session does not exist'
      });
    }

    const logs = await TelemetryLog.findBySession(sessionId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      eventType,
      sortBy,
      sortOrder: parseInt(sortOrder)
    });

    const total = await TelemetryLog.countDocuments({ sessionId });

    res.json({
      sessionId,
      logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Session logs retrieval error:', error);
    res.status(500).json({
      error: 'Session logs retrieval failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/log/student/:studentId - Get logs for a specific student
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { 
      limit = 100, 
      offset = 0, 
      eventType,
      startDate,
      endDate 
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = { studentId };
    if (eventType) query.eventType = eventType;
    if (Object.keys(dateFilter).length > 0) {
      query.serverTimestamp = dateFilter;
    }

    const logs = await TelemetryLog.find(query)
      .sort({ serverTimestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await TelemetryLog.countDocuments(query);

    res.json({
      studentId,
      logs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Student logs retrieval error:', error);
    res.status(500).json({
      error: 'Student logs retrieval failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/log/errors - Get error logs
router.get('/errors', async (req, res) => {
  try {
    const { 
      studentId,
      sessionId,
      severity,
      limit = 50,
      offset = 0
    } = req.query;

    const errors = await TelemetryLog.findErrors({
      studentId,
      sessionId,
      severity,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await TelemetryLog.countDocuments({ 
      eventType: 'error',
      ...(studentId && { studentId }),
      ...(sessionId && { sessionId }),
      ...(severity && { 'data.severity': severity })
    });

    res.json({
      errors,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error logs retrieval error:', error);
    res.status(500).json({
      error: 'Error logs retrieval failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/log/stats - Get telemetry statistics
router.get('/stats', async (req, res) => {
  try {
    const { 
      sessionId,
      studentId,
      startDate,
      endDate
    } = req.query;

    const filter = {};
    if (sessionId) filter.sessionId = sessionId;
    if (studentId) filter.studentId = studentId;
    if (startDate || endDate) {
      filter.serverTimestamp = {};
      if (startDate) filter.serverTimestamp.$gte = new Date(startDate);
      if (endDate) filter.serverTimestamp.$lte = new Date(endDate);
    }

    const stats = await TelemetryLog.getEventStats(filter);
    const errorAnalysis = await TelemetryLog.getErrorAnalysis(filter);

    res.json({
      filter,
      stats,
      errorAnalysis
    });

  } catch (error) {
    console.error('Telemetry stats retrieval error:', error);
    res.status(500).json({
      error: 'Telemetry stats retrieval failed',
      message: 'Internal server error'
    });
  }
});

// Helper function to update session metrics
async function updateSessionMetrics(session, telemetryLog) {
  try {
    const { eventType, step, data } = telemetryLog;

    // Update total actions
    session.totalActions += 1;

    // Update last activity
    session.lastActivity = new Date();

    switch (eventType) {
      case 'step_start':
        // Initialize step data if not exists
        if (!session.stepData[step]) {
          session.stepData[step] = {
            timeSpent: 0,
            errors: 0
          };
        }
        break;

      case 'step_complete':
        if (step && session.stepData[step]) {
          if (telemetryLog.duration) {
            session.stepData[step].timeSpent += telemetryLog.duration;
          }
          session.stepsCompleted += 1;
        }
        break;

      case 'error':
        session.totalErrors += 1;
        if (data && data.severity === 'critical') {
          session.criticalErrors += 1;
        }
        if (step && session.stepData[step]) {
          session.stepData[step].errors += 1;
        }
        break;

      case 'action':
        // Track specific actions if needed
        break;

      case 'temperature_change':
        // Track temperature-related events
        break;
    }

    await session.save();
  } catch (error) {
    console.error('Error updating session metrics:', error);
  }
}

module.exports = router;
