const express = require('express');
const { query, validationResult } = require('express-validator');
const Student = require('../models/Student');
const StudentSession = require('../models/StudentSession');
const TelemetryLog = require('../models/TelemetryLog');

const router = express.Router();

// GET /api/reports/student/:studentId - Get student performance report
router.get('/student/:studentId', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studentId } = req.params;
    const { startDate, endDate, limit = 10 } = req.query;

    // Verify student exists
    const student = await Student.findOne({ studentId, isActive: true });
    if (!student) {
      return res.status(404).json({
        error: 'Student not found',
        message: 'Student does not exist or is inactive'
      });
    }

    // Get student sessions
    const sessionQuery = { studentId, isCompleted: true };
    if (startDate || endDate) {
      sessionQuery.startTime = {};
      if (startDate) sessionQuery.startTime.$gte = new Date(startDate);
      if (endDate) sessionQuery.startTime.$lte = new Date(endDate);
    }

    const sessions = await StudentSession.find(sessionQuery)
      .sort({ startTime: -1 })
      .limit(parseInt(limit));

    // Calculate performance metrics
    const totalSessions = sessions.length;
    const averageScore = sessions.reduce((sum, session) => sum + session.score, 0) / totalSessions || 0;
    const totalErrors = sessions.reduce((sum, session) => sum + session.totalErrors, 0);
    const criticalErrors = sessions.reduce((sum, session) => sum + session.criticalErrors, 0);
    const averageTime = sessions.reduce((sum, session) => sum + session.totalTime, 0) / totalSessions || 0;

    // Get step completion statistics
    const stepStats = {
      selection: { completed: 0, avgTime: 0, avgErrors: 0 },
      heating: { completed: 0, avgTime: 0, avgErrors: 0 },
      emulsification: { completed: 0, avgTime: 0, avgErrors: 0 },
      cooling: { completed: 0, avgTime: 0, avgErrors: 0 },
      evaluation: { completed: 0, avgTime: 0, avgErrors: 0 }
    };

    sessions.forEach(session => {
      Object.keys(stepStats).forEach(step => {
        if (session.stepData[step]) {
          stepStats[step].completed += 1;
          stepStats[step].avgTime += session.stepData[step].timeSpent || 0;
          stepStats[step].avgErrors += session.stepData[step].errors || 0;
        }
      });
    });

    // Calculate averages
    Object.keys(stepStats).forEach(step => {
      const completed = stepStats[step].completed;
      if (completed > 0) {
        stepStats[step].avgTime /= completed;
        stepStats[step].avgErrors /= completed;
      }
    });

    // Get recent errors
    const recentErrors = await TelemetryLog.findErrors({
      studentId,
      limit: 20
    });

    res.json({
      student: student.toPublicJSON(),
      performance: {
        totalSessions,
        averageScore: Math.round(averageScore * 100) / 100,
        totalErrors,
        criticalErrors,
        averageTime: Math.round(averageTime / 1000), // Convert to seconds
        completionRate: (sessions.filter(s => s.isCompleted).length / totalSessions * 100).toFixed(1) + '%'
      },
      stepStatistics: stepStats,
      recentSessions: sessions.slice(0, 5),
      recentErrors
    });

  } catch (error) {
    console.error('Student report error:', error);
    res.status(500).json({
      error: 'Student report generation failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/reports/class/:classId - Get class performance report
router.get('/class/:classId', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    // Get class statistics
    const classStats = await StudentSession.getClassStats(classId, startDate, endDate);

    // Get all students in the class
    const students = await Student.find({ classId, isActive: true })
      .select('studentId firstName lastName email')
      .sort({ lastName: 1, firstName: 1 });

    // Get individual student performance
    const studentPerformance = await Promise.all(
      students.map(async (student) => {
        const { averageScore, totalSessions } = await StudentSession.getAverageScore(student.studentId);
        
        const sessionQuery = { 
          studentId: student.studentId, 
          isCompleted: true 
        };
        
        if (startDate || endDate) {
          sessionQuery.startTime = {};
          if (startDate) sessionQuery.startTime.$gte = new Date(startDate);
          if (endDate) sessionQuery.startTime.$lte = new Date(endDate);
        }

        const recentSessions = await StudentSession.find(sessionQuery)
          .sort({ startTime: -1 })
          .limit(3);

        return {
          studentId: student.studentId,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          averageScore: Math.round(averageScore * 100) / 100,
          totalSessions,
          recentSessions: recentSessions.map(s => ({
            sessionId: s.sessionId,
            score: s.score,
            startTime: s.startTime,
            isCompleted: s.isCompleted
          }))
        };
      })
    );

    // Get common errors in the class
    const errorFilter = {};
    if (startDate || endDate) {
      errorFilter.serverTimestamp = {};
      if (startDate) errorFilter.serverTimestamp.$gte = new Date(startDate);
      if (endDate) errorFilter.serverTimestamp.$lte = new Date(endDate);
    }

    const studentIds = students.map(s => s.studentId);
    const errorAnalysis = await TelemetryLog.getErrorAnalysis({
      studentId: { $in: studentIds },
      ...errorFilter
    });

    res.json({
      classId,
      classStatistics: {
        ...classStats,
        averageTime: Math.round(classStats.averageTime / 1000), // Convert to seconds
        totalStudents: students.length
      },
      studentPerformance,
      commonErrors: errorAnalysis.slice(0, 10)
    });

  } catch (error) {
    console.error('Class report error:', error);
    res.status(500).json({
      error: 'Class report generation failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/reports/overview - Get system-wide overview
router.get('/overview', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.startTime = {};
      if (startDate) dateFilter.startTime.$gte = new Date(startDate);
      if (endDate) dateFilter.startTime.$lte = new Date(endDate);
    }

    // Get overall statistics
    const totalStudents = await Student.countDocuments({ isActive: true });
    const totalSessions = await StudentSession.countDocuments({ isCompleted: true, ...dateFilter });
    const activeStudents = await StudentSession.distinct('studentId', { 
      isActive: true,
      ...dateFilter 
    });

    // Get performance metrics
    const sessionStats = await StudentSession.aggregate([
      { $match: { isCompleted: true, ...dateFilter } },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$score' },
          averageTime: { $avg: '$totalTime' },
          totalErrors: { $sum: '$totalErrors' },
          criticalErrors: { $sum: '$criticalErrors' },
          perfectScores: { $sum: { $cond: [{ $eq: ['$score', 100] }, 1, 0] } }
        }
      }
    ]);

    const stats = sessionStats.length > 0 ? sessionStats[0] : {
      averageScore: 0,
      averageTime: 0,
      totalErrors: 0,
      criticalErrors: 0,
      perfectScores: 0
    };

    // Get class distribution
    const classDistribution = await Student.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$classId',
          studentCount: { $sum: 1 }
        }
      },
      { $sort: { studentCount: -1 } }
    ]);

    // Get recent activity
    const recentActivity = await TelemetryLog.find({})
      .sort({ serverTimestamp: -1 })
      .limit(20)
      .select('sessionId studentId eventType step serverTimestamp data');

    res.json({
      overview: {
        totalStudents,
        activeStudents: activeStudents.length,
        totalSessions,
        averageScore: Math.round(stats.averageScore * 100) / 100,
        averageTime: Math.round(stats.averageTime / 1000), // Convert to seconds
        totalErrors: stats.totalErrors,
        criticalErrors: stats.criticalErrors,
        perfectScores: stats.perfectScores,
        completionRate: totalSessions > 0 ? ((stats.perfectScores / totalSessions) * 100).toFixed(1) + '%' : '0%'
      },
      classDistribution,
      recentActivity
    });

  } catch (error) {
    console.error('Overview report error:', error);
    res.status(500).json({
      error: 'Overview report generation failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/reports/errors - Get error analysis report
router.get('/errors', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  query('severity').optional().isIn(['warning', 'error', 'critical']).withMessage('Invalid severity level'),
  query('step').optional().isIn(['selection', 'heating', 'emulsification', 'cooling', 'evaluation']).withMessage('Invalid step')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { startDate, endDate, severity, step } = req.query;

    // Build filter
    const filter = {};
    if (startDate || endDate) {
      filter.serverTimestamp = {};
      if (startDate) filter.serverTimestamp.$gte = new Date(startDate);
      if (endDate) filter.serverTimestamp.$lte = new Date(endDate);
    }
    if (severity) {
      filter['data.severity'] = severity;
    }
    if (step) {
      filter.step = step;
    }

    // Get error analysis
    const errorAnalysis = await TelemetryLog.getErrorAnalysis(filter);

    // Get error trends over time
    const errorTrends = await TelemetryLog.aggregate([
      { $match: { eventType: 'error', ...filter } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$serverTimestamp' } },
            severity: '$data.severity'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          severities: {
            $push: {
              severity: '$_id.severity',
              count: '$count'
            }
          },
          totalErrors: { $sum: '$count' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    // Get error distribution by step
    const stepDistribution = await TelemetryLog.aggregate([
      { $match: { eventType: 'error', ...filter } },
      {
        $group: {
          _id: '$step',
          count: { $sum: 1 },
          uniqueStudents: { $addToSet: '$studentId' }
        }
      },
      {
        $project: {
          step: '$_id',
          count: 1,
          uniqueStudentCount: { $size: '$uniqueStudents' },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      filter,
      errorAnalysis: errorAnalysis.slice(0, 20),
      errorTrends,
      stepDistribution
    });

  } catch (error) {
    console.error('Error report error:', error);
    res.status(500).json({
      error: 'Error report generation failed',
      message: 'Internal server error'
    });
  }
});

// GET /api/reports/progress/:studentId - Get student progress timeline
router.get('/progress/:studentId', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studentId } = req.params;
    const { limit = 20 } = req.query;

    // Verify student exists
    const student = await Student.findOne({ studentId, isActive: true });
    if (!student) {
      return res.status(404).json({
        error: 'Student not found',
        message: 'Student does not exist or is inactive'
      });
    }

    // Get student timeline
    const timeline = await TelemetryLog.getStudentTimeline(studentId, {
      limit: parseInt(limit)
    });

    // Get session summaries
    const sessions = await StudentSession.find({ studentId })
      .sort({ startTime: -1 })
      .limit(10)
      .select('sessionId startTime endTime score isCompleted totalErrors stepsCompleted');

    res.json({
      student: student.toPublicJSON(),
      timeline,
      recentSessions: sessions
    });

  } catch (error) {
    console.error('Progress report error:', error);
    res.status(500).json({
      error: 'Progress report generation failed',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
