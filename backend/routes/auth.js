const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Student = require('../models/Student');
const StudentSession = require('../models/StudentSession');

const router = express.Router();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: 'Access denied',
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Invalid token',
      message: 'Token verification failed'
    });
  }
};

// Register a new student
router.post('/register', [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('classId').notEmpty().withMessage('Class ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studentId, email, password, firstName, lastName, classId } = req.body;

    // Check if student already exists
    const existingStudent = await Student.findOne({
      $or: [{ studentId }, { email }]
    });

    if (existingStudent) {
      return res.status(409).json({
        error: 'Student already exists',
        message: existingStudent.studentId === studentId 
          ? 'Student ID already registered' 
          : 'Email already registered'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new student
    const student = new Student({
      studentId,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      classId
    });

    await student.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        studentId: student.studentId, 
        email: student.email,
        role: student.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Student registered successfully',
      token,
      student: student.toPublicJSON()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
});

// Student login
router.post('/login', [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { studentId, password } = req.body;

    // Find student
    const student = await Student.findOne({ studentId, isActive: true });
    if (!student) {
      return res.status(401).json({
        error: 'Login failed',
        message: 'Invalid student ID or password'
      });
    }

    // Check password
    const isPasswordValid = await student.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Login failed',
        message: 'Invalid student ID or password'
      });
    }

    // Update last login
    student.lastLogin = new Date();
    await student.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        studentId: student.studentId, 
        email: student.email,
        role: student.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      student: student.toPublicJSON()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error'
    });
  }
});

// Create a new simulation session
router.post('/session', verifyToken, [
  body('simulationType').optional().isIn(['vanishing_cream']).withMessage('Invalid simulation type'),
  body('configuration').optional().isObject().withMessage('Configuration must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { simulationType = 'vanishing_cream', configuration = {} } = req.body;
    const { studentId } = req.user;

    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create new session
    const session = new StudentSession({
      sessionId,
      studentId,
      simulationType,
      configuration
    });

    await session.save();

    res.status(201).json({
      message: 'Session created successfully',
      sessionId,
      session
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      error: 'Session creation failed',
      message: 'Internal server error'
    });
  }
});

// Get session details
router.get('/session/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId } = req.user;

    const session = await StudentSession.findOne({ 
      sessionId, 
      studentId 
    });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Session does not exist or access denied'
      });
    }

    res.json({
      session
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({
      error: 'Session retrieval failed',
      message: 'Internal server error'
    });
  }
});

// End a simulation session
router.post('/session/:sessionId/end', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { studentId } = req.user;

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

    // End session
    session.isActive = false;
    session.endTime = new Date();
    session.isCompleted = true;
    session.totalTime = session.getDuration();

    await session.save();

    res.json({
      message: 'Session ended successfully',
      session
    });

  } catch (error) {
    console.error('Session ending error:', error);
    res.status(500).json({
      error: 'Session ending failed',
      message: 'Internal server error'
    });
  }
});

// Get student's active sessions
router.get('/sessions', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.user;
    const { limit = 10, offset = 0, active = true } = req.query;

    const query = { studentId };
    if (active === 'true') {
      query.isActive = true;
    }

    const sessions = await StudentSession.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await StudentSession.countDocuments(query);

    res.json({
      sessions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Sessions retrieval error:', error);
    res.status(500).json({
      error: 'Sessions retrieval failed',
      message: 'Internal server error'
    });
  }
});

// Verify token endpoint
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.user;
    const student = await Student.findOne({ studentId, isActive: true });

    if (!student) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Student account not found or inactive'
      });
    }

    res.json({
      valid: true,
      student: student.toPublicJSON()
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      error: 'Token verification failed',
      message: 'Internal server error'
    });
  }
});

module.exports = router;
