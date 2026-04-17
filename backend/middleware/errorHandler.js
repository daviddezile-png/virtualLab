const mongoose = require('mongoose');

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      statusCode: 400,
      message: 'Validation Error',
      details: message
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    error = {
      statusCode: 409,
      message: 'Duplicate Field Error',
      details: `${field} '${value}' already exists`
    };
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    error = {
      statusCode: 400,
      message: 'Invalid ID format',
      details: 'The provided ID is not valid'
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      statusCode: 401,
      message: 'Invalid token',
      details: 'The provided token is not valid'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      statusCode: 401,
      message: 'Token expired',
      details: 'The provided token has expired'
    };
  }

  // Rate limiting errors
  if (err.status === 429) {
    error = {
      statusCode: 429,
      message: 'Too many requests',
      details: 'Rate limit exceeded. Please try again later.'
    };
  }

  // Default error
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const details = error.details || (process.env.NODE_ENV === 'development' ? err.stack : 'Something went wrong');

  res.status(statusCode).json({
    error: message,
    details,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

module.exports = errorHandler;
