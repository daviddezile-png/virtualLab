const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  classId: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
studentSchema.index({ studentId: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ classId: 1 });
studentSchema.index({ isActive: 1 });

// Pre-save middleware to update timestamps
studentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to compare password
studentSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
studentSchema.methods.toPublicJSON = function() {
  const student = this.toObject();
  delete student.password;
  return student;
};

// Static method to find active students
studentSchema.statics.findActive = function(filter = {}) {
  return this.find({ ...filter, isActive: true });
};

module.exports = mongoose.model('Student', studentSchema);
